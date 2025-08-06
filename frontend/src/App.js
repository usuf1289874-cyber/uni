import React, { useState, useEffect } from 'react';
import './App.css';

const App = () => {
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const [showRegistrationModal, setShowRegistrationModal] = useState(false);
  const [selectedPackage, setSelectedPackage] = useState(null);
  const [activeTrainer, setActiveTrainer] = useState(0);
  const [packages, setPackages] = useState({});
  const [isLoading, setIsLoading] = useState(false);
  const [paymentStatus, setPaymentStatus] = useState('');

  const [registrationData, setRegistrationData] = useState({
    name: '',
    phone: '',
    child_name: '',
    child_age: '',
    email: '',
    additional_info: ''
  });

  const trainers = [
    {
      name: "Анна Петровна",
      specialty: "Инструктор по плаванию для малышей",
      experience: "8 лет опыта",
      image: "https://images.unsplash.com/photo-1599376871063-1b999e42afde?crop=entropy&cs=srgb&fm=jpg&ixid=M3w3NDQ2MzR8MHwxfHNlYXJjaHwyfHxraWRzJTIwcG9vbHxlbnwwfHx8fDE3NTQ1MDg1ODN8MA&ixlib=rb-4.1.0&q=85"
    },
    {
      name: "Сергей Иванович",
      specialty: "Тренер по спортивному плаванию",
      experience: "12 лет опыта",
      image: "https://images.unsplash.com/photo-1574744918163-6cef6f4a31b0?crop=entropy&cs=srgb&fm=jpg&ixid=M3w3NTY2NzF8MHwxfHNlYXJjaHwxfHxjaGlsZHJlbiUyMHN3aW1taW5nfGVufDB8fHx8MTc1NDUwODU3N3ww&ixlib=rb-4.1.0&q=85"
    },
    {
      name: "Мария Александровна",
      specialty: "Аква-аэробика для детей",
      experience: "6 лет опыта", 
      image: "https://images.unsplash.com/photo-1592484806287-7bc9c8af5405?crop=entropy&cs=srgb&fm=jpg&ixid=M3w3NTY2NzF8MHwxfHNlYXJjaHwyfHxjaGlsZHJlbiUyMHN3aW1taW5nfGVufDB8fHx8MTc1NDUwODU3N3ww&ixlib=rb-4.1.0&q=85"
    }
  ];

  useEffect(() => {
    fetchPackages();
    checkPaymentReturn();
  }, []);

  const fetchPackages = async () => {
    try {
      const response = await fetch(`${process.env.REACT_APP_BACKEND_URL}/api/packages`);
      const data = await response.json();
      setPackages(data.packages);
    } catch (error) {
      console.error('Error fetching packages:', error);
    }
  };

  const checkPaymentReturn = () => {
    const urlParams = new URLSearchParams(window.location.search);
    const sessionId = urlParams.get('session_id');
    
    if (sessionId) {
      setPaymentStatus('checking');
      pollPaymentStatus(sessionId);
    }
  };

  const pollPaymentStatus = async (sessionId, attempts = 0) => {
    const maxAttempts = 5;
    
    if (attempts >= maxAttempts) {
      setPaymentStatus('timeout');
      return;
    }

    try {
      const response = await fetch(`${process.env.REACT_APP_BACKEND_URL}/api/checkout/status/${sessionId}`);
      if (!response.ok) throw new Error('Failed to check payment status');

      const data = await response.json();
      
      if (data.payment_status === 'paid') {
        setPaymentStatus('success');
        return;
      } else if (data.status === 'expired') {
        setPaymentStatus('expired');
        return;
      }

      setTimeout(() => pollPaymentStatus(sessionId, attempts + 1), 2000);
    } catch (error) {
      console.error('Error checking payment status:', error);
      setPaymentStatus('error');
    }
  };

  const handleRegistrationSubmit = async (e) => {
    e.preventDefault();
    if (!selectedPackage) return;

    setIsLoading(true);
    
    try {
      const checkoutRequest = {
        package_id: selectedPackage,
        registration_data: {
          ...registrationData,
          child_age: parseInt(registrationData.child_age),
          package_id: selectedPackage
        },
        origin_url: window.location.origin
      };

      const response = await fetch(`${process.env.REACT_APP_BACKEND_URL}/api/checkout/session`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(checkoutRequest)
      });

      if (!response.ok) throw new Error('Failed to create checkout session');

      const data = await response.json();
      window.location.href = data.checkout_url;
    } catch (error) {
      console.error('Error creating checkout session:', error);
      setIsLoading(false);
    }
  };

  const PaymentStatusModal = () => {
    if (!paymentStatus) return null;

    const getStatusContent = () => {
      switch (paymentStatus) {
        case 'checking':
          return {
            title: 'Проверяем платеж...',
            message: 'Пожалуйста, подождите',
            className: 'text-blue-600',
            showSpinner: true
          };
        case 'success':
          return {
            title: 'Платеж успешен!',
            message: 'Спасибо за покупку. Мы свяжемся с вами в ближайшее время.',
            className: 'text-green-600'
          };
        case 'expired':
          return {
            title: 'Время сессии истекло',
            message: 'Попробуйте еще раз',
            className: 'text-red-600'
          };
        default:
          return {
            title: 'Ошибка проверки платежа',
            message: 'Пожалуйста, свяжитесь с нами',
            className: 'text-red-600'
          };
      }
    };

    const status = getStatusContent();

    return (
      <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
        <div className="bg-white p-6 rounded-lg max-w-md w-full mx-4">
          <h3 className={`text-xl font-bold mb-4 ${status.className}`}>
            {status.title}
          </h3>
          <p className="mb-4">{status.message}</p>
          {status.showSpinner && (
            <div className="flex justify-center">
              <div className="spinner"></div>
            </div>
          )}
          {paymentStatus !== 'checking' && (
            <button
              onClick={() => {
                setPaymentStatus('');
                window.history.replaceState({}, document.title, window.location.pathname);
              }}
              className="w-full bg-blue-600 text-white py-2 rounded hover:bg-blue-700"
            >
              Закрыть
            </button>
          )}
        </div>
      </div>
    );
  };

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Navigation */}
      <nav className="bg-white shadow-lg fixed w-full top-0 z-40">
        <div className="max-w-7xl mx-auto px-4">
          <div className="flex justify-between items-center py-4">
            <div className="flex items-center">
              <button
                onClick={() => setIsMenuOpen(true)}
                className="mr-4 p-2 rounded-lg hover:bg-gray-100 transition-colors"
              >
                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
                </svg>
              </button>
              <div className="text-2xl font-bold text-blue-600">UniBaby Pool</div>
            </div>
            <div className="hidden md:flex space-x-8">
              <a href="#home" className="text-gray-700 hover:text-blue-600 transition-colors">Главная</a>
              <a href="#trainers" className="text-gray-700 hover:text-blue-600 transition-colors">Тренеры</a>
              <a href="#packages" className="text-gray-700 hover:text-blue-600 transition-colors">Абонементы</a>
              <a href="#location" className="text-gray-700 hover:text-blue-600 transition-colors">Адрес</a>
            </div>
          </div>
        </div>
      </nav>

      {/* Side Menu */}
      <div className={`fixed inset-0 z-50 transition-opacity ${isMenuOpen ? 'opacity-100' : 'opacity-0 pointer-events-none'}`}>
        <div className="absolute inset-0 bg-black bg-opacity-50" onClick={() => setIsMenuOpen(false)}></div>
        <div className={`absolute left-0 top-0 h-full w-80 bg-white shadow-xl transform transition-transform ${isMenuOpen ? 'translate-x-0' : '-translate-x-full'}`}>
          <div className="p-6">
            <div className="flex justify-between items-center mb-8">
              <h2 className="text-2xl font-bold text-blue-600">UniBaby Pool</h2>
              <button onClick={() => setIsMenuOpen(false)} className="p-2 hover:bg-gray-100 rounded">
                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
            <nav className="space-y-4">
              <a href="#home" className="block py-3 px-4 rounded-lg hover:bg-blue-50 hover:text-blue-600 transition-colors" onClick={() => setIsMenuOpen(false)}>
                🏠 Главная
              </a>
              <a href="#trainers" className="block py-3 px-4 rounded-lg hover:bg-blue-50 hover:text-blue-600 transition-colors" onClick={() => setIsMenuOpen(false)}>
                👨‍🏫 Наши тренеры
              </a>
              <a href="#packages" className="block py-3 px-4 rounded-lg hover:bg-blue-50 hover:text-blue-600 transition-colors" onClick={() => setIsMenuOpen(false)}>
                💎 Абонементы
              </a>
              <a href="#location" className="block py-3 px-4 rounded-lg hover:bg-blue-50 hover:text-blue-600 transition-colors" onClick={() => setIsMenuOpen(false)}>
                📍 Где мы находимся
              </a>
            </nav>
          </div>
        </div>
      </div>

      {/* Hero Section */}
      <section id="home" className="pt-20 min-h-screen flex items-center bg-gradient-to-br from-blue-600 to-cyan-500">
        <div className="max-w-7xl mx-auto px-4 py-20">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-12 items-center">
            <div className="text-white">
              <h1 className="text-5xl font-bold mb-6 animate-fade-in">
                Детский бассейн <span className="text-yellow-300">UniBaby</span>
              </h1>
              <p className="text-xl mb-8 animate-fade-in-delay">
                Профессиональное обучение плаванию для детей от 0 до 12 лет. 
                Безопасность, комфорт и индивидуальный подход к каждому ребенку.
              </p>
              <div className="flex flex-col sm:flex-row gap-4 animate-fade-in-delay-2">
                <a href="#packages" className="bg-yellow-400 text-gray-900 px-8 py-3 rounded-lg font-semibold hover:bg-yellow-300 transition-colors text-center">
                  Выбрать абонемент
                </a>
                <a href="#trainers" className="border-2 border-white text-white px-8 py-3 rounded-lg font-semibold hover:bg-white hover:text-blue-600 transition-colors text-center">
                  Наши тренеры
                </a>
              </div>
            </div>
            <div className="animate-float">
              <img 
                src="https://images.unsplash.com/photo-1574744918163-6cef6f4a31b0?crop=entropy&cs=srgb&fm=jpg&ixid=M3w3NTY2NzF8MHwxfHNlYXJjaHwxfHxjaGlsZHJlbiUyMHN3aW1taW5nfGVufDB8fHx8MTc1NDUwODU3N3ww&ixlib=rb-4.1.0&q=85"
                alt="Детское плавание"
                className="rounded-lg shadow-2xl w-full h-96 object-cover"
              />
            </div>
          </div>
        </div>
      </section>

      {/* Features Section */}
      <section className="py-20 bg-white">
        <div className="max-w-7xl mx-auto px-4">
          <div className="text-center mb-16">
            <h2 className="text-4xl font-bold text-gray-900 mb-4">Почему выбирают нас?</h2>
            <p className="text-xl text-gray-600">Создаем безопасную и дружелюбную среду для обучения плаванию</p>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
            <div className="text-center feature-card">
              <div className="bg-blue-100 w-20 h-20 rounded-full flex items-center justify-center mx-auto mb-6">
                <span className="text-4xl">🏊‍♀️</span>
              </div>
              <h3 className="text-2xl font-semibold mb-4">Профессиональные тренеры</h3>
              <p className="text-gray-600">Сертифицированные инструкторы с многолетним опытом работы с детьми</p>
            </div>
            <div className="text-center feature-card">
              <div className="bg-green-100 w-20 h-20 rounded-full flex items-center justify-center mx-auto mb-6">
                <span className="text-4xl">🛡️</span>
              </div>
              <h3 className="text-2xl font-semibold mb-4">Безопасность превыше всего</h3>
              <p className="text-gray-600">Современное оборудование и постоянный контроль за безопасностью детей</p>
            </div>
            <div className="text-center feature-card">
              <div className="bg-yellow-100 w-20 h-20 rounded-full flex items-center justify-center mx-auto mb-6">
                <span className="text-4xl">👶</span>
              </div>
              <h3 className="text-2xl font-semibold mb-4">Индивидуальный подход</h3>
              <p className="text-gray-600">Программы адаптированы для каждой возрастной группы</p>
            </div>
          </div>
        </div>
      </section>

      {/* Trainers Section */}
      <section id="trainers" className="py-20 bg-gray-100">
        <div className="max-w-7xl mx-auto px-4">
          <div className="text-center mb-16">
            <h2 className="text-4xl font-bold text-gray-900 mb-4">Наши тренеры</h2>
            <p className="text-xl text-gray-600">Профессиональная команда с любовью к детям</p>
          </div>
          
          <div className="flex justify-center mb-8">
            <div className="bg-white rounded-lg p-2 shadow-lg">
              {trainers.map((trainer, index) => (
                <button
                  key={index}
                  onClick={() => setActiveTrainer(index)}
                  className={`px-6 py-3 rounded-lg mx-1 transition-all ${
                    activeTrainer === index 
                      ? 'bg-blue-600 text-white shadow-lg' 
                      : 'text-gray-600 hover:bg-gray-100'
                  }`}
                >
                  {trainer.name.split(' ')[0]}
                </button>
              ))}
            </div>
          </div>

          <div className="trainer-slider">
            <div className="bg-white rounded-xl shadow-lg overflow-hidden max-w-4xl mx-auto">
              <div className="md:flex">
                <div className="md:w-1/2">
                  <img 
                    src={trainers[activeTrainer].image}
                    alt={trainers[activeTrainer].name}
                    className="w-full h-96 object-cover"
                  />
                </div>
                <div className="md:w-1/2 p-8 flex flex-col justify-center">
                  <h3 className="text-3xl font-bold text-gray-900 mb-4">
                    {trainers[activeTrainer].name}
                  </h3>
                  <p className="text-xl text-blue-600 mb-4">
                    {trainers[activeTrainer].specialty}
                  </p>
                  <p className="text-gray-600 mb-6">
                    {trainers[activeTrainer].experience}
                  </p>
                  <div className="flex items-center text-yellow-500">
                    <span className="text-lg">★★★★★</span>
                    <span className="ml-2 text-gray-600">5.0 рейтинг</span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Packages Section */}
      <section id="packages" className="py-20 bg-white">
        <div className="max-w-7xl mx-auto px-4">
          <div className="text-center mb-16">
            <h2 className="text-4xl font-bold text-gray-900 mb-4">Абонементы</h2>
            <p className="text-xl text-gray-600">Выберите подходящую программу для вашего ребенка</p>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-8">
            {Object.entries(packages).map(([key, pkg]) => (
              <div key={key} className="package-card bg-white rounded-xl shadow-lg p-6 border-2 border-transparent hover:border-blue-500 transition-all">
                <div className="text-center">
                  <h3 className="text-2xl font-bold text-gray-900 mb-2">{pkg.name}</h3>
                  <div className="text-4xl font-bold text-blue-600 mb-2">
                    {pkg.price.toLocaleString()} ₸
                  </div>
                  <p className="text-gray-600 mb-6">{pkg.sessions} занятий</p>
                  
                  <ul className="text-left space-y-2 mb-8">
                    <li className="flex items-center">
                      <span className="text-green-500 mr-2">✓</span>
                      Профессиональный тренер
                    </li>
                    <li className="flex items-center">
                      <span className="text-green-500 mr-2">✓</span>
                      Современное оборудование
                    </li>
                    <li className="flex items-center">
                      <span className="text-green-500 mr-2">✓</span>
                      Индивидуальный подход
                    </li>
                    <li className="flex items-center">
                      <span className="text-green-500 mr-2">✓</span>
                      Справка после курса
                    </li>
                  </ul>
                  
                  <button
                    onClick={() => {
                      setSelectedPackage(key);
                      setShowRegistrationModal(true);
                    }}
                    className="w-full bg-blue-600 text-white py-3 rounded-lg font-semibold hover:bg-blue-700 transition-colors"
                  >
                    Оплатить
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Location Section */}
      <section id="location" className="py-20 bg-gray-100">
        <div className="max-w-7xl mx-auto px-4">
          <div className="text-center mb-16">
            <h2 className="text-4xl font-bold text-gray-900 mb-4">Где мы находимся</h2>
            <p className="text-xl text-gray-600">Приходите к нам на пробное занятие</p>
          </div>
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-12">
            <div className="space-y-6">
              <div className="bg-white p-6 rounded-lg shadow-lg">
                <h3 className="text-2xl font-semibold mb-4 text-blue-600">Контактная информация</h3>
                <div className="space-y-3">
                  <p className="flex items-center">
                    <span className="text-2xl mr-3">📍</span>
                    <span>г. Алматы, ул. Примерная, 123</span>
                  </p>
                  <p className="flex items-center">
                    <span className="text-2xl mr-3">📞</span>
                    <span>+7 (701) 123-45-67</span>
                  </p>
                  <p className="flex items-center">
                    <span className="text-2xl mr-3">⏰</span>
                    <span>Ежедневно: 08:00 - 21:00</span>
                  </p>
                  <p className="flex items-center">
                    <span className="text-2xl mr-3">📧</span>
                    <span>info@unibaby-pool.kz</span>
                  </p>
                </div>
              </div>
              <div className="bg-white p-6 rounded-lg shadow-lg">
                <h3 className="text-2xl font-semibold mb-4 text-blue-600">Следите за нами</h3>
                <div className="flex space-x-4">
                  <a href="https://www.instagram.com/unibaby_uniflex" target="_blank" rel="noopener noreferrer" className="bg-pink-500 text-white p-3 rounded-lg hover:bg-pink-600 transition-colors">
                    📷 Instagram
                  </a>
                </div>
              </div>
            </div>
            <div className="bg-white rounded-lg shadow-lg overflow-hidden h-96">
              <div id="map-container" className="w-full h-full bg-gray-200 flex items-center justify-center">
                <iframe
                  src="https://widgets.2gis.com/widget?type=frame&options=%7B%22pos%22%3A%7B%22lat%22%3A43.238293%2C%22lon%22%3A76.889311%2C%22zoom%22%3A16%7D%2C%22opt%22%3A%7B%22city%22%3A%22almaty%22%7D%2C%22org%22%3A%2270000001018827992%22%7D&apiKey=43f2e69b-d76c-4a96-ae35-a5434860146c"
                  width="100%"
                  height="100%"
                  frameBorder="0"
                  title="2GIS Map"
                ></iframe>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Registration Modal */}
      {showRegistrationModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white p-8 rounded-lg max-w-md w-full mx-4 max-h-screen overflow-y-auto">
            <div className="flex justify-between items-center mb-6">
              <h3 className="text-2xl font-bold text-gray-900">Регистрация</h3>
              <button
                onClick={() => setShowRegistrationModal(false)}
                className="text-gray-500 hover:text-gray-700"
              >
                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
            
            {selectedPackage && packages[selectedPackage] && (
              <div className="bg-blue-50 p-4 rounded-lg mb-6">
                <p className="font-semibold text-blue-800">Выбранный пакет:</p>
                <p className="text-blue-600">{packages[selectedPackage].name}</p>
                <p className="text-blue-600 font-bold">{packages[selectedPackage].price.toLocaleString()} ₸</p>
              </div>
            )}

            <form onSubmit={handleRegistrationSubmit} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Имя родителя *
                </label>
                <input
                  type="text"
                  required
                  value={registrationData.name}
                  onChange={(e) => setRegistrationData({...registrationData, name: e.target.value})}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
              
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Телефон *
                </label>
                <input
                  type="tel"
                  required
                  value={registrationData.phone}
                  onChange={(e) => setRegistrationData({...registrationData, phone: e.target.value})}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
              
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Имя ребенка *
                </label>
                <input
                  type="text"
                  required
                  value={registrationData.child_name}
                  onChange={(e) => setRegistrationData({...registrationData, child_name: e.target.value})}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
              
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Возраст ребенка *
                </label>
                <input
                  type="number"
                  min="0"
                  max="18"
                  required
                  value={registrationData.child_age}
                  onChange={(e) => setRegistrationData({...registrationData, child_age: e.target.value})}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
              
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Email
                </label>
                <input
                  type="email"
                  value={registrationData.email}
                  onChange={(e) => setRegistrationData({...registrationData, email: e.target.value})}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
              
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Дополнительная информация
                </label>
                <textarea
                  rows="3"
                  value={registrationData.additional_info}
                  onChange={(e) => setRegistrationData({...registrationData, additional_info: e.target.value})}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                  placeholder="Особенности, медицинские противопоказания, пожелания..."
                />
              </div>
              
              <div className="flex gap-3 pt-4">
                <button
                  type="button"
                  onClick={() => setShowRegistrationModal(false)}
                  className="flex-1 px-4 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50"
                >
                  Отмена
                </button>
                <button
                  type="submit"
                  disabled={isLoading}
                  className="flex-1 bg-blue-600 text-white py-2 rounded-lg hover:bg-blue-700 disabled:opacity-50 flex items-center justify-center"
                >
                  {isLoading ? (
                    <div className="spinner mr-2"></div>
                  ) : null}
                  {isLoading ? 'Обработка...' : 'Перейти к оплате'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Payment Status Modal */}
      <PaymentStatusModal />

      {/* Footer */}
      <footer className="bg-gray-900 text-white py-12">
        <div className="max-w-7xl mx-auto px-4">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
            <div>
              <h3 className="text-2xl font-bold mb-4">UniBaby Pool</h3>
              <p className="text-gray-400">
                Детский бассейн с профессиональным подходом к обучению плаванию
              </p>
            </div>
            <div>
              <h4 className="text-lg font-semibold mb-4">Контакты</h4>
              <p className="text-gray-400">📞 +7 (701) 123-45-67</p>
              <p className="text-gray-400">📧 info@unibaby-pool.kz</p>
            </div>
            <div>
              <h4 className="text-lg font-semibold mb-4">Режим работы</h4>
              <p className="text-gray-400">Пн-Вс: 08:00 - 21:00</p>
            </div>
          </div>
          <div className="border-t border-gray-800 mt-8 pt-8 text-center text-gray-400">
            <p>&copy; 2024 UniBaby Pool. Все права защищены.</p>
          </div>
        </div>
      </footer>
    </div>
  );
};

export default App;