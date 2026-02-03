import { Routes, Route } from 'react-router-dom';
import { useState } from 'react';
import './styles/App.css';
import Navbar from './components/layout/Navbar';
import Home from './pages/Home';
import About from './pages/About';
import Login from './pages/Login';
import Register from './pages/Register';
import Footer from './components/layout/Footer';
import Chatbot from './components/common/Chatbot';
import Feed from './pages/Feed';
import ServiceProviderPortfolio from './pages/ServiceProviderPortfolio';


function App() {
  const [isChatbotOpen, setIsChatbotOpen] = useState(false);

  return (
    <div className="app">
      <Navbar />
      
      <Routes>
        <Route path="/" element={<Home />} />
        <Route path="/about" element={<About />} />
        <Route path="/login" element={<Login />} />
        <Route path="/register" element={<Register />} />
        <Route path="/feed" element={<Feed />} />
        <Route path="/provider/:id" element={<ServiceProviderPortfolio />} />
       
      </Routes>
      
      <Footer />
      
      <button 
        className="floating-btn"
        onClick={() => setIsChatbotOpen(true)}
        aria-label="Open chat support"
      >
        <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"></path>
        </svg>
      </button>

      <Chatbot isOpen={isChatbotOpen} onClose={() => setIsChatbotOpen(false)} />
    </div>
  );
}

export default App;