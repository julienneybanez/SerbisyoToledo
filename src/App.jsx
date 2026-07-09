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
import ServiceProviderDashboard from './pages/ServiceProviderDashboard';
import Requests from './pages/Requests';
import ClientSettings from './pages/ClientSettings';
import ServiceProviderSettings from './pages/ServiceProviderSettings';

// Admin imports
import AdminLayout from './components/layout/AdminLayout';
import AdminDashboard from './pages/admin/AdminDashboard';
import AdminUsers from './pages/admin/AdminUsers';
import AdminVerifications from './pages/admin/AdminVerifications';
import AdminReports from './pages/admin/AdminReports';
import AdminSettings from './pages/admin/AdminSettings';


function App() {
  const [isChatbotOpen, setIsChatbotOpen] = useState(false);

  return (
    <Routes>
      {/* Admin Routes - No regular Navbar/Footer */}
      <Route path="/admin" element={<AdminLayout />}>
        <Route index element={<AdminDashboard />} />
        <Route path="dashboard" element={<AdminDashboard />} />
        <Route path="users" element={<AdminUsers />} />
        <Route path="verifications" element={<AdminVerifications />} />
        <Route path="reports" element={<AdminReports />} />
        <Route path="settings" element={<AdminSettings />} />
      </Route>

      {/* Public Routes - With regular Navbar/Footer */}
      <Route path="/*" element={
        <div className="app">
          <Navbar />
          
          <Routes>
            <Route path="/" element={<Home />} />
            <Route path="/about" element={<About />} />
            <Route path="/login" element={<Login />} />
            <Route path="/register" element={<Register />} />
            <Route path="/feed" element={<Feed />} />
            <Route path="/dashboard" element={<ServiceProviderDashboard />} />
            <Route path="/provider/:id" element={<ServiceProviderPortfolio />} />
            <Route path="/requests" element={<Requests />} />
            <Route path="/client-settings" element={<ClientSettings />} />
            <Route path="/provider-settings" element={<ServiceProviderSettings />} />
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
      } />
    </Routes>
  );
}

export default App;