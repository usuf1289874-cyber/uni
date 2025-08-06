#!/usr/bin/env python3
"""
Backend API Tests for UniBaby Children's Pool
Tests all critical endpoints for the swimming pool registration and payment system
"""

import requests
import json
import time
import os
from datetime import datetime

# Get backend URL from environment
BACKEND_URL = "https://d06c5d6f-0f83-4b1d-a46e-d86baa71ebae.preview.emergentagent.com/api"
FRONTEND_URL = "https://d06c5d6f-0f83-4b1d-a46e-d86baa71ebae.preview.emergentagent.com"

# Test data for realistic children's pool registration
TEST_REGISTRATION_DATA = {
    "name": "Анна Смирнова",
    "phone": "+7 777 123 4567", 
    "child_name": "Максим",
    "child_age": 4,
    "package_id": "junior_swim",
    "email": "anna.smirnova@example.com",
    "additional_info": "Ребенок умеет держаться на воде"
}

EXPECTED_PACKAGES = {
    "baby_splash": {"name": "Baby Splash (0-2 года)", "price": 15000.0, "currency": "kzt", "sessions": 8},
    "junior_swim": {"name": "Junior Swim (3-5 лет)", "price": 18000.0, "currency": "kzt", "sessions": 8},
    "aqua_kids": {"name": "Aqua Kids (6-12 лет)", "price": 20000.0, "currency": "kzt", "sessions": 8},
    "individual": {"name": "Индивидуальные занятия", "price": 8000.0, "currency": "kzt", "sessions": 1}
}

def print_test_header(test_name):
    print(f"\n{'='*60}")
    print(f"TESTING: {test_name}")
    print(f"{'='*60}")

def print_result(success, message):
    status = "✅ PASS" if success else "❌ FAIL"
    print(f"{status}: {message}")

def test_health_endpoint():
    """Test the health check endpoint"""
    print_test_header("Health Check Endpoint")
    
    try:
        response = requests.get(f"{BACKEND_URL}/health", timeout=10)
        
        if response.status_code == 200:
            data = response.json()
            if data.get("status") == "healthy" and data.get("service") == "unibaby_pool":
                print_result(True, "Health endpoint working correctly")
                return True
            else:
                print_result(False, f"Unexpected health response: {data}")
                return False
        else:
            print_result(False, f"Health endpoint returned status {response.status_code}")
            return False
            
    except Exception as e:
        print_result(False, f"Health endpoint error: {str(e)}")
        return False

def test_packages_endpoint():
    """Test the packages endpoint"""
    print_test_header("Swimming Packages Endpoint")
    
    try:
        response = requests.get(f"{BACKEND_URL}/packages", timeout=10)
        
        if response.status_code == 200:
            data = response.json()
            packages = data.get("packages", {})
            
            # Check if all expected packages are present
            missing_packages = []
            for package_id, expected_data in EXPECTED_PACKAGES.items():
                if package_id not in packages:
                    missing_packages.append(package_id)
                else:
                    package = packages[package_id]
                    # Verify package structure
                    if not all(key in package for key in ["name", "price", "currency", "sessions"]):
                        print_result(False, f"Package {package_id} missing required fields")
                        return False
                    
                    # Verify currency is KZT
                    if package["currency"] != "kzt":
                        print_result(False, f"Package {package_id} has wrong currency: {package['currency']}")
                        return False
            
            if missing_packages:
                print_result(False, f"Missing packages: {missing_packages}")
                return False
            
            print_result(True, f"All {len(packages)} swimming packages loaded correctly with KZT pricing")
            print(f"Available packages: {list(packages.keys())}")
            return True
            
        else:
            print_result(False, f"Packages endpoint returned status {response.status_code}")
            return False
            
    except Exception as e:
        print_result(False, f"Packages endpoint error: {str(e)}")
        return False

def test_register_endpoint():
    """Test user registration endpoint"""
    print_test_header("User Registration Endpoint")
    
    try:
        response = requests.post(
            f"{BACKEND_URL}/register",
            json=TEST_REGISTRATION_DATA,
            headers={"Content-Type": "application/json"},
            timeout=10
        )
        
        if response.status_code == 200:
            data = response.json()
            
            # Check required fields in response
            if all(key in data for key in ["registration_id", "status", "message"]):
                if data["status"] == "registered":
                    print_result(True, f"Registration successful with ID: {data['registration_id']}")
                    return True, data["registration_id"]
                else:
                    print_result(False, f"Registration status not 'registered': {data['status']}")
                    return False, None
            else:
                print_result(False, f"Registration response missing required fields: {data}")
                return False, None
                
        else:
            print_result(False, f"Registration endpoint returned status {response.status_code}: {response.text}")
            return False, None
            
    except Exception as e:
        print_result(False, f"Registration endpoint error: {str(e)}")
        return False, None

def test_invalid_package_registration():
    """Test registration with invalid package"""
    print_test_header("Invalid Package Registration")
    
    invalid_data = TEST_REGISTRATION_DATA.copy()
    invalid_data["package_id"] = "invalid_package"
    
    try:
        response = requests.post(
            f"{BACKEND_URL}/register",
            json=invalid_data,
            headers={"Content-Type": "application/json"},
            timeout=10
        )
        
        if response.status_code == 400:
            print_result(True, "Invalid package correctly rejected with 400 status")
            return True
        else:
            print_result(False, f"Expected 400 for invalid package, got {response.status_code}")
            return False
            
    except Exception as e:
        print_result(False, f"Invalid package test error: {str(e)}")
        return False

def test_checkout_session_creation():
    """Test Stripe checkout session creation"""
    print_test_header("Stripe Checkout Session Creation")
    
    checkout_data = {
        "package_id": "junior_swim",
        "registration_data": TEST_REGISTRATION_DATA,
        "origin_url": FRONTEND_URL
    }
    
    try:
        response = requests.post(
            f"{BACKEND_URL}/checkout/session",
            json=checkout_data,
            headers={"Content-Type": "application/json"},
            timeout=15
        )
        
        if response.status_code == 200:
            data = response.json()
            
            # Check required fields in response
            required_fields = ["checkout_url", "session_id", "registration_id"]
            if all(key in data for key in required_fields):
                # Verify checkout URL is from Stripe
                if "stripe.com" in data["checkout_url"]:
                    print_result(True, f"Checkout session created successfully")
                    print(f"Session ID: {data['session_id']}")
                    print(f"Registration ID: {data['registration_id']}")
                    return True, data["session_id"]
                else:
                    print_result(False, f"Invalid checkout URL: {data['checkout_url']}")
                    return False, None
            else:
                print_result(False, f"Checkout response missing required fields: {data}")
                return False, None
                
        elif response.status_code == 500:
            # Check if it's a Stripe configuration issue
            if "Stripe not configured" in response.text:
                print_result(False, "Stripe API key not configured - this is expected in test environment")
                return False, None
            else:
                print_result(False, f"Checkout session creation failed: {response.text}")
                return False, None
        else:
            print_result(False, f"Checkout endpoint returned status {response.status_code}: {response.text}")
            return False, None
            
    except Exception as e:
        print_result(False, f"Checkout session creation error: {str(e)}")
        return False, None

def test_checkout_status_endpoint(session_id=None):
    """Test checkout status endpoint"""
    print_test_header("Checkout Status Endpoint")
    
    # Use a test session ID if none provided
    test_session_id = session_id or "cs_test_1234567890"
    
    try:
        response = requests.get(
            f"{BACKEND_URL}/checkout/status/{test_session_id}",
            timeout=10
        )
        
        if response.status_code == 404:
            print_result(True, "Checkout status correctly returns 404 for non-existent session")
            return True
        elif response.status_code == 500:
            if "Stripe not configured" in response.text:
                print_result(False, "Stripe API key not configured - this is expected in test environment")
                return False
        elif response.status_code == 200:
            data = response.json()
            required_fields = ["status", "payment_status", "amount_total", "currency"]
            if all(key in data for key in required_fields):
                print_result(True, f"Checkout status endpoint working correctly")
                return True
            else:
                print_result(False, f"Status response missing required fields: {data}")
                return False
        else:
            print_result(False, f"Checkout status returned unexpected status {response.status_code}: {response.text}")
            return False
            
    except Exception as e:
        print_result(False, f"Checkout status endpoint error: {str(e)}")
        return False

def test_stripe_webhook_endpoint():
    """Test Stripe webhook endpoint"""
    print_test_header("Stripe Webhook Endpoint")
    
    # Test webhook with missing signature (should fail)
    try:
        response = requests.post(
            f"{BACKEND_URL}/webhook/stripe",
            json={"test": "data"},
            headers={"Content-Type": "application/json"},
            timeout=10
        )
        
        if response.status_code == 400:
            if "Missing Stripe signature" in response.text:
                print_result(True, "Webhook correctly rejects requests without Stripe signature")
                return True
            else:
                print_result(False, f"Unexpected 400 error: {response.text}")
                return False
        elif response.status_code == 500:
            if "Stripe not configured" in response.text:
                print_result(False, "Stripe API key not configured - this is expected in test environment")
                return False
        else:
            print_result(False, f"Webhook returned unexpected status {response.status_code}: {response.text}")
            return False
            
    except Exception as e:
        print_result(False, f"Webhook endpoint error: {str(e)}")
        return False

def run_all_tests():
    """Run all backend API tests"""
    print(f"\n🏊‍♀️ UNIBABY CHILDREN'S POOL - BACKEND API TESTS")
    print(f"Backend URL: {BACKEND_URL}")
    print(f"Test started at: {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}")
    
    test_results = {}
    
    # Test 1: Health Check
    test_results["health"] = test_health_endpoint()
    
    # Test 2: Swimming Packages
    test_results["packages"] = test_packages_endpoint()
    
    # Test 3: User Registration
    registration_success, registration_id = test_register_endpoint()
    test_results["registration"] = registration_success
    
    # Test 4: Invalid Package Registration
    test_results["invalid_package"] = test_invalid_package_registration()
    
    # Test 5: Checkout Session Creation
    checkout_success, session_id = test_checkout_session_creation()
    test_results["checkout_session"] = checkout_success
    
    # Test 6: Checkout Status
    test_results["checkout_status"] = test_checkout_status_endpoint(session_id)
    
    # Test 7: Stripe Webhook
    test_results["webhook"] = test_stripe_webhook_endpoint()
    
    # Summary
    print(f"\n{'='*60}")
    print("TEST SUMMARY")
    print(f"{'='*60}")
    
    passed = sum(1 for result in test_results.values() if result)
    total = len(test_results)
    
    for test_name, result in test_results.items():
        status = "✅ PASS" if result else "❌ FAIL"
        print(f"{status} {test_name}")
    
    print(f"\nOverall: {passed}/{total} tests passed")
    
    if passed == total:
        print("🎉 All backend API tests passed!")
    else:
        print("⚠️  Some tests failed - check individual test results above")
    
    return test_results

if __name__ == "__main__":
    run_all_tests()