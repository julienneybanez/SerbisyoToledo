import { Routes, Route } from 'react-router-dom';
import { useEffect, useMemo, useState } from 'react';
import './styles/App.css';
import Navbar from './components/layout/Navbar';
import Home from './pages/Home';
import About from './pages/About';
import Login from './pages/Login';
import Register from './pages/Register';
import ForgotPassword from './pages/ForgotPassword';
import ResetPassword from './pages/ResetPassword';
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
import { getUser, isAuthenticated } from './services/api';
import GuidedTour from './components/common/GuidedTour';
import TourWelcomeModal from './components/common/TourWelcomeModal';

const CLIENT_TOUR_STEPS = [
  {
    title: 'Browse Services',
    description: 'Discover available service providers in Toledo City from this page.',
    route: '/feed',
    selector: '[data-tour="browse-services"]',
  },
  {
    title: 'Search and Filters',
    description: 'Use search, category buttons, and filters to narrow providers quickly.',
    route: '/feed',
    selector: '[data-tour="feed-search-filters"]',
  },
  {
    title: 'Provider Profile',
    description: 'Open a provider profile to see ratings, details, and services offered.',
    route: '/feed',
    selector: '[data-tour="provider-profile-trigger"]',
  },
  {
    title: 'Request Service',
    description: 'Inside a provider profile, use Request Service to submit your booking details.',
    route: '/feed',
    selector: '.tour-provider-request-step',
  },
  {
    title: 'My Bookings',
    description: 'Track your requests and booking progress in the Requests section.',
    route: '/requests',
    selector: '[data-tour="nav-requests"]',
  },
];

const PROVIDER_TOUR_STEPS = [
  {
    title: 'Provider Profile',
    description: 'Use this action to create or update your service profile.',
    route: '/dashboard',
    selector: '[data-tour="provider-profile-setup"]',
  },
  {
    title: 'Services Offered',
    description: 'Complete your profile checklist so clients can discover your services.',
    route: '/dashboard',
    selector: '.profile-checklist',
  },
  {
    title: 'Availability',
    description: 'Update your availability settings for incoming jobs.',
    route: '/provider-settings',
    selector: '[data-tour="provider-availability-tab"]',
  },
  {
    title: 'Portfolio',
    description: 'Add portfolio content to showcase your completed work.',
    route: '/provider-settings',
    selector: '[data-tour="provider-business-tab"]',
  },
  {
    title: 'Incoming Booking Requests',
    description: 'Review and respond to client requests from your request list.',
    route: '/requests',
    selector: '[data-tour="incoming-requests"]',
  },
];

function App() {
  const [isChatbotOpen, setIsChatbotOpen] = useState(false);
  const [currentUser, setCurrentUser] = useState(getUser());
  const [showTourPrompt, setShowTourPrompt] = useState(false);
  const [showGuidedTour, setShowGuidedTour] = useState(false);

  const getTourStorageKey = (user) => `serbisyoToledoTour_${user.id}_${user.userType}`;

  useEffect(() => {
    const updateAuthState = () => {
      setCurrentUser(getUser());
    };

    updateAuthState();
    window.addEventListener('storage', updateAuthState);
    window.addEventListener('authChange', updateAuthState);

    return () => {
      window.removeEventListener('storage', updateAuthState);
      window.removeEventListener('authChange', updateAuthState);
    };
  }, []);

  useEffect(() => {
    if (!isAuthenticated() || !currentUser) {
      setShowTourPrompt(false);
      setShowGuidedTour(false);
      return;
    }

    if (!['client', 'tradesperson'].includes(currentUser.userType)) {
      setShowTourPrompt(false);
      setShowGuidedTour(false);
      return;
    }

    const key = getTourStorageKey(currentUser);
    const persisted = localStorage.getItem(key);
    const sessionLater = sessionStorage.getItem(`${key}_later`);

    if (persisted === 'completed' || persisted === 'dismissed' || sessionLater === '1') {
      setShowTourPrompt(false);
      return;
    }

    setShowTourPrompt(true);
  }, [currentUser]);

  const activeTourSteps = useMemo(() => {
    if (currentUser?.userType === 'tradesperson') {
      return PROVIDER_TOUR_STEPS;
    }

    if (currentUser?.userType === 'client') {
      return CLIENT_TOUR_STEPS;
    }

    return [];
  }, [currentUser]);

  const handleStartTour = () => {
    setShowTourPrompt(false);
    setShowGuidedTour(true);
  };

  const handleMaybeLater = () => {
    if (!currentUser) return;
    const key = getTourStorageKey(currentUser);
    sessionStorage.setItem(`${key}_later`, '1');
    setShowTourPrompt(false);
  };

  const handleDontShowAgain = () => {
    if (!currentUser) return;
    const key = getTourStorageKey(currentUser);
    localStorage.setItem(key, 'dismissed');
    setShowTourPrompt(false);
    setShowGuidedTour(false);
  };

  const handleTourFinish = () => {
    if (!currentUser) return;
    const key = getTourStorageKey(currentUser);
    localStorage.setItem(key, 'completed');
    setShowGuidedTour(false);
  };

  const handleTourSkip = () => {
    if (currentUser) {
      const key = getTourStorageKey(currentUser);
      sessionStorage.setItem(`${key}_later`, '1');
    }
    setShowGuidedTour(false);
  };

  return (
    <>
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

            <main className="main-content">
              <Routes>
                <Route path="/" element={<Home />} />
                <Route path="/about" element={<About />} />
                <Route path="/login" element={<Login />} />
                <Route path="/register" element={<Register />} />
                <Route path="/forgot-password" element={<ForgotPassword />} />
                <Route path="/reset-password/:token" element={<ResetPassword />} />
                <Route path="/feed" element={<Feed />} />
                <Route path="/dashboard" element={<ServiceProviderDashboard />} />
                <Route path="/provider/:id" element={<ServiceProviderPortfolio />} />
                <Route path="/requests" element={<Requests />} />
                <Route path="/client-settings" element={<ClientSettings />} />
                <Route path="/provider-settings" element={<ServiceProviderSettings />} />
              </Routes>
            </main>
            
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

      <TourWelcomeModal
        show={showTourPrompt}
        roleLabel={currentUser?.userType === 'tradesperson' ? 'service providers' : 'clients'}
        onStart={handleStartTour}
        onMaybeLater={handleMaybeLater}
        onDontShowAgain={handleDontShowAgain}
      />

      <GuidedTour
        show={showGuidedTour}
        steps={activeTourSteps}
        onFinish={handleTourFinish}
        onSkip={handleTourSkip}
      />
    </>
  );
}

export default App;