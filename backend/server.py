import os
import uuid
from datetime import datetime
from typing import Optional, Dict, List
from fastapi import FastAPI, HTTPException, Request
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, Field
from pymongo import MongoClient
from emergentintegrations.payments.stripe.checkout import StripeCheckout, CheckoutSessionResponse, CheckoutStatusResponse, CheckoutSessionRequest

# Database setup
mongo_url = os.environ.get('MONGO_URL', 'mongodb://localhost:27017')
client = MongoClient(mongo_url)
db = client['unibaby_pool']

# Collections
registrations_collection = db['registrations']
payment_transactions_collection = db['payment_transactions']

app = FastAPI()

# CORS middleware
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Stripe setup
STRIPE_API_KEY = os.environ.get('STRIPE_API_KEY')

# Swimming packages with fixed prices
SWIMMING_PACKAGES = {
    "baby_splash": {"name": "Baby Splash (0-2 года)", "price": 15000.0, "currency": "kzt", "sessions": 8},
    "junior_swim": {"name": "Junior Swim (3-5 лет)", "price": 18000.0, "currency": "kzt", "sessions": 8},
    "aqua_kids": {"name": "Aqua Kids (6-12 лет)", "price": 20000.0, "currency": "kzt", "sessions": 8},
    "individual": {"name": "Индивидуальные занятия", "price": 8000.0, "currency": "kzt", "sessions": 1}
}

# Models
class RegistrationData(BaseModel):
    name: str
    phone: str
    child_name: str
    child_age: int
    package_id: str
    email: Optional[str] = None
    additional_info: Optional[str] = None

class CheckoutRequest(BaseModel):
    package_id: str
    registration_data: RegistrationData
    origin_url: str

# API Routes
@app.get("/api/health")
async def health_check():
    return {"status": "healthy", "service": "unibaby_pool"}

@app.get("/api/packages")
async def get_packages():
    return {"packages": SWIMMING_PACKAGES}

@app.post("/api/register")
async def register_user(registration: RegistrationData):
    # Validate package
    if registration.package_id not in SWIMMING_PACKAGES:
        raise HTTPException(status_code=400, detail="Invalid package selected")
    
    # Create registration record
    registration_id = str(uuid.uuid4())
    registration_doc = {
        "id": registration_id,
        "name": registration.name,
        "phone": registration.phone,
        "child_name": registration.child_name,
        "child_age": registration.child_age,
        "package_id": registration.package_id,
        "package_info": SWIMMING_PACKAGES[registration.package_id],
        "email": registration.email,
        "additional_info": registration.additional_info,
        "created_at": datetime.utcnow(),
        "status": "pending_payment"
    }
    
    registrations_collection.insert_one(registration_doc)
    
    return {
        "registration_id": registration_id,
        "status": "registered",
        "message": "Registration successful"
    }

@app.post("/api/checkout/session")
async def create_checkout_session(request: CheckoutRequest):
    if not STRIPE_API_KEY:
        raise HTTPException(status_code=500, detail="Stripe not configured")
    
    # Validate package
    if request.package_id not in SWIMMING_PACKAGES:
        raise HTTPException(status_code=400, detail="Invalid package")
    
    package = SWIMMING_PACKAGES[request.package_id]
    
    # Register user first
    registration = await register_user(request.registration_data)
    registration_id = registration["registration_id"]
    
    # Initialize Stripe
    webhook_url = f"{request.origin_url}/api/webhook/stripe"
    stripe_checkout = StripeCheckout(api_key=STRIPE_API_KEY, webhook_url=webhook_url)
    
    # Create checkout session
    success_url = f"{request.origin_url}/success?session_id={{CHECKOUT_SESSION_ID}}"
    cancel_url = f"{request.origin_url}/"
    
    checkout_request = CheckoutSessionRequest(
        amount=package["price"],
        currency=package["currency"],
        success_url=success_url,
        cancel_url=cancel_url,
        metadata={
            "registration_id": registration_id,
            "package_id": request.package_id,
            "child_name": request.registration_data.child_name,
            "parent_name": request.registration_data.name
        }
    )
    
    session = await stripe_checkout.create_checkout_session(checkout_request)
    
    # Create payment transaction record
    payment_doc = {
        "id": str(uuid.uuid4()),
        "session_id": session.session_id,
        "registration_id": registration_id,
        "package_id": request.package_id,
        "amount": package["price"],
        "currency": package["currency"],
        "payment_status": "pending",
        "status": "initiated",
        "metadata": checkout_request.metadata,
        "created_at": datetime.utcnow()
    }
    
    payment_transactions_collection.insert_one(payment_doc)
    
    return {
        "checkout_url": session.url,
        "session_id": session.session_id,
        "registration_id": registration_id
    }

@app.get("/api/checkout/status/{session_id}")
async def get_checkout_status(session_id: str):
    if not STRIPE_API_KEY:
        raise HTTPException(status_code=500, detail="Stripe not configured")
    
    # Initialize Stripe
    stripe_checkout = StripeCheckout(api_key=STRIPE_API_KEY, webhook_url="")
    
    # Get payment status from Stripe
    checkout_status = await stripe_checkout.get_checkout_status(session_id)
    
    # Find payment transaction
    payment_doc = payment_transactions_collection.find_one({"session_id": session_id})
    if not payment_doc:
        raise HTTPException(status_code=404, detail="Payment transaction not found")
    
    # Update payment status if changed
    if payment_doc["payment_status"] != checkout_status.payment_status:
        update_data = {
            "payment_status": checkout_status.payment_status,
            "status": checkout_status.status,
            "updated_at": datetime.utcnow()
        }
        
        payment_transactions_collection.update_one(
            {"session_id": session_id},
            {"$set": update_data}
        )
        
        # Update registration status if payment completed
        if checkout_status.payment_status == "paid":
            registrations_collection.update_one(
                {"id": payment_doc["registration_id"]},
                {"$set": {"status": "paid", "updated_at": datetime.utcnow()}}
            )
    
    return {
        "status": checkout_status.status,
        "payment_status": checkout_status.payment_status,
        "amount_total": checkout_status.amount_total,
        "currency": checkout_status.currency,
        "metadata": checkout_status.metadata
    }

@app.post("/api/webhook/stripe")
async def stripe_webhook(request: Request):
    if not STRIPE_API_KEY:
        raise HTTPException(status_code=500, detail="Stripe not configured")
    
    webhook_body = await request.body()
    stripe_signature = request.headers.get("Stripe-Signature")
    
    if not stripe_signature:
        raise HTTPException(status_code=400, detail="Missing Stripe signature")
    
    # Initialize Stripe
    stripe_checkout = StripeCheckout(api_key=STRIPE_API_KEY, webhook_url="")
    
    try:
        webhook_response = await stripe_checkout.handle_webhook(webhook_body, stripe_signature)
        
        # Process the webhook event
        if webhook_response.event_type == "checkout.session.completed":
            # Update payment transaction
            payment_transactions_collection.update_one(
                {"session_id": webhook_response.session_id},
                {
                    "$set": {
                        "payment_status": webhook_response.payment_status,
                        "event_id": webhook_response.event_id,
                        "webhook_processed_at": datetime.utcnow()
                    }
                }
            )
            
            # Update registration if payment successful
            if webhook_response.payment_status == "paid":
                payment_doc = payment_transactions_collection.find_one({"session_id": webhook_response.session_id})
                if payment_doc:
                    registrations_collection.update_one(
                        {"id": payment_doc["registration_id"]},
                        {"$set": {"status": "confirmed", "updated_at": datetime.utcnow()}}
                    )
        
        return {"status": "success"}
    
    except Exception as e:
        raise HTTPException(status_code=400, detail=f"Webhook error: {str(e)}")

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8001)