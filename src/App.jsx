import { Routes, Route } from 'react-router-dom';
import { Suspense, lazy, useCallback, useEffect, useMemo, useState } from 'react';
import './styles/App.css';
import Navbar from './components/layout/Navbar';
import Footer from './components/layout/Footer';
import MobileTopBar from './components/mobile/MobileTopBar';
import MobileBottomNav from './components/mobile/MobileBottomNav';
import EditProfileModal from './components/common/EditProfileModal';
import EditPortfolioModal from './components/common/EditPortfolioModal';
import ServiceProfileModal from './components/common/ServiceProfileModal';
import VerificationRequestModal from './components/common/VerificationRequestModal';

// Admin imports
import AdminLayout from './components/layout/AdminLayout';
import { getUser, isAuthenticated, removeToken, serviceProfileAPI } from './services/api';
import GuidedTour from './components/common/GuidedTour';
import TourWelcomeModal from './components/common/TourWelcomeModal';

const Home = lazy(() => import('./pages/Home'));
const About = lazy(() => import('./pages/About'));
const Login = lazy(() => import('./pages/Login'));
const Register = lazy(() => import('./pages/Register'));
const ForgotPassword = lazy(() => import('./pages/ForgotPassword'));
const ResetPassword = lazy(() => import('./pages/ResetPassword'));
const VerifyEmail = lazy(() => import('./pages/VerifyEmail'));
const Feed = lazy(() => import('./pages/Feed'));
const ServiceProviderPortfolio = lazy(() => import('./pages/ServiceProviderPortfolio'));
const ServiceProviderDashboard = lazy(() => import('./pages/ServiceProviderDashboard'));
const Requests = lazy(() => import('./pages/Requests'));
const ClientSettings = lazy(() => import('./pages/ClientSettings'));
const ServiceProviderSettings = lazy(() => import('./pages/ServiceProviderSettings'));
const Chatbot = lazy(() => import('./components/common/Chatbot'));
const AdminDashboard = lazy(() => import('./pages/admin/AdminDashboard'));
const AdminUsers = lazy(() => import('./pages/admin/AdminUsers'));
const AdminVerifications = lazy(() => import('./pages/admin/AdminVerifications'));
const AdminReports = lazy(() => import('./pages/admin/AdminReports'));
const AdminSettings = lazy(() => import('./pages/admin/AdminSettings'));

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
    description: 'Set your typical response time in Edit Profile so clients know when to expect updates.',
    route: '/dashboard',
    action: 'openProviderEditProfile',
    selector: '[data-tour="provider-response-time"]',
  },
  {
    title: 'Portfolio',
    description: 'Upload portfolio images in Edit Profile to showcase your completed work.',
    route: '/dashboard',
    action: 'openProviderEditProfile',
    selector: '[data-tour="provider-portfolio-images"]',
  },
  {
    title: 'Incoming Booking Requests',
    description: 'Review and respond to client requests from your request list.',
    route: '/requests',
    selector: '[data-tour="incoming-requests"]',
  },
];

const MOBILE_BREAKPOINT_PX = 768;

function App() {
  const [isChatbotOpen, setIsChatbotOpen] = useState(false);
  const [currentUser, setCurrentUser] = useState(getUser());
  const [showTourPrompt, setShowTourPrompt] = useState(false);
  const [showGuidedTour, setShowGuidedTour] = useState(false);
  const [isMobileViewport, setIsMobileViewport] = useState(() => (
    window.matchMedia(`(max-width: ${MOBILE_BREAKPOINT_PX}px)`).matches
  ));
  const [mobileProfileMenuOpen, setMobileProfileMenuOpen] = useState(false);
  const [showMobileEditProfile, setShowMobileEditProfile] = useState(false);
  const [showMobileEditPortfolio, setShowMobileEditPortfolio] = useState(false);
  const [showMobileServiceProfile, setShowMobileServiceProfile] = useState(false);
  const [showMobileVerificationRequest, setShowMobileVerificationRequest] = useState(false);
  const [hasServiceProfile, setHasServiceProfile] = useState(false);
  const [providerPublicProfileRoute, setProviderPublicProfileRoute] = useState('/dashboard');

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
    const mediaQuery = window.matchMedia(`(max-width: ${MOBILE_BREAKPOINT_PX}px)`);
    const handleViewportChange = (event) => {
      setIsMobileViewport(event.matches);
    };

    if (typeof mediaQuery.addEventListener === 'function') {
      mediaQuery.addEventListener('change', handleViewportChange);
      return () => mediaQuery.removeEventListener('change', handleViewportChange);
    }

    mediaQuery.addListener(handleViewportChange);
    return () => mediaQuery.removeListener(handleViewportChange);
  }, []);

  useEffect(() => {
    if (!currentUser || currentUser.userType !== 'tradesperson') {
      const timer = setTimeout(() => {
        setHasServiceProfile(false);
        setProviderPublicProfileRoute('/dashboard');
      }, 0);
      return () => clearTimeout(timer);
    }

    let isMounted = true;

    const loadProviderProfile = async () => {
      try {
        const response = await serviceProfileAPI.getMyProfile();
        if (!isMounted) {
          return;
        }

        const hasProfile = Boolean(response?.success && response?.data?.id);
        setHasServiceProfile(hasProfile);
        setProviderPublicProfileRoute(hasProfile ? `/provider/${response.data.id}` : '/dashboard');
      } catch {
        if (!isMounted) {
          return;
        }

        setHasServiceProfile(false);
        setProviderPublicProfileRoute('/dashboard');
      }
    };

    loadProviderProfile();

    return () => {
      isMounted = false;
    };
  }, [currentUser]);

  useEffect(() => {
    if (!isAuthenticated() || !currentUser) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
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

  const isMobileAuthenticated = Boolean(
    isMobileViewport
    && currentUser
    && ['client', 'tradesperson'].includes(currentUser.userType)
    && isAuthenticated()
  );
  const isMobileShellLayout = isMobileViewport;

  const mobileRole = currentUser?.userType || 'guest';
  const mobileSettingsRoute = mobileRole === 'tradesperson' ? '/provider-settings' : '/client-settings';

  const handleOpenMobileProfileMenu = useCallback(() => {
    setMobileProfileMenuOpen(true);
  }, []);

  const handleCloseMobileProfileMenu = useCallback(() => {
    setMobileProfileMenuOpen(false);
  }, []);

  const handleToggleMobileProfileMenu = useCallback(() => {
    setMobileProfileMenuOpen((open) => !open);
  }, []);

  const handleMobileLogout = () => {
    removeToken();
    setMobileProfileMenuOpen(false);
    window.dispatchEvent(new Event('authChange'));
  };

  const appLoadingFallback = (
    <div className="text-center py-4">Loading...</div>
  );

  return (
    <>
      <Suspense fallback={appLoadingFallback}>
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
            <div className={`app ${isMobileShellLayout ? 'mobile-shell-layout' : ''} ${isMobileAuthenticated ? 'mobile-auth-layout' : ''}`}>
              {isMobileShellLayout && (
                <MobileTopBar
                  user={currentUser}
                  role={mobileRole}
                  profileRoute={providerPublicProfileRoute}
                  settingsRoute={mobileSettingsRoute}
                  onLogout={handleMobileLogout}
                  profileMenuOpen={mobileProfileMenuOpen}
                  onToggleProfileMenu={handleToggleMobileProfileMenu}
                  onCloseProfileMenu={handleCloseMobileProfileMenu}
                  onEditClientProfile={() => {
                    setMobileProfileMenuOpen(false);
                    setShowMobileEditProfile(true);
                  }}
                  hasServiceProfile={hasServiceProfile}
                  onEditProviderProfile={() => {
                    setMobileProfileMenuOpen(false);
                    setShowMobileEditPortfolio(true);
                  }}
                  onManageServiceProfile={() => {
                    setMobileProfileMenuOpen(false);
                    setShowMobileServiceProfile(true);
                  }}
                  onRequestVerification={() => {
                    setMobileProfileMenuOpen(false);
                    setShowMobileVerificationRequest(true);
                  }}
                  onPreviewProfile={() => {
                    setMobileProfileMenuOpen(false);
                    const separator = providerPublicProfileRoute.includes('?') ? '&' : '?';
                    window.location.assign(`${providerPublicProfileRoute}${separator}previewMode=mobile`);
                  }}
                />
              )}

              <div className={isMobileShellLayout ? 'desktop-navbar-hidden' : ''}>
                <Navbar />
              </div>

              <main className={`main-content ${isMobileShellLayout ? 'mobile-page-content' : ''} ${isMobileAuthenticated ? 'authenticated-page-content' : ''}`}>
                <Routes>
                  <Route path="/" element={<Home />} />
                  <Route path="/about" element={<About />} />
                  <Route path="/login" element={<Login />} />
                  <Route path="/register" element={<Register />} />
                  <Route path="/forgot-password" element={<ForgotPassword />} />
                  <Route path="/reset-password/:token" element={<ResetPassword />} />
                  <Route path="/verify-email" element={<VerifyEmail />} />
                  <Route path="/feed" element={<Feed />} />
                  <Route path="/dashboard" element={<ServiceProviderDashboard />} />
                  <Route path="/provider/:id" element={<ServiceProviderPortfolio />} />
                  <Route path="/requests" element={<Requests />} />
                  <Route path="/client-settings" element={<ClientSettings />} />
                  <Route path="/provider-settings" element={<ServiceProviderSettings />} />
                </Routes>
              </main>

              {isMobileShellLayout && (
                <MobileBottomNav
                  role={mobileRole}
                  profileMenuOpen={mobileProfileMenuOpen}
                  onProfileTap={mobileProfileMenuOpen ? handleCloseMobileProfileMenu : handleOpenMobileProfileMenu}
                />
              )}
              
              <Footer className={isMobileAuthenticated ? 'mobile-footer-minimized' : ''} />
              
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

              {showMobileEditProfile && (
                <EditProfileModal
                  onClose={() => setShowMobileEditProfile(false)}
                  onProfileUpdated={() => {
                    setShowMobileEditProfile(false);
                  }}
                />
              )}

              {showMobileEditPortfolio && (
                <EditPortfolioModal
                  onClose={() => setShowMobileEditPortfolio(false)}
                />
              )}

              {showMobileServiceProfile && (
                <ServiceProfileModal
                  onClose={() => setShowMobileServiceProfile(false)}
                />
              )}

              {showMobileVerificationRequest && (
                <VerificationRequestModal
                  onClose={() => setShowMobileVerificationRequest(false)}
                />
              )}
            </div>
          } />
        </Routes>
      </Suspense>

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