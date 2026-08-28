import { Outlet, Route, Routes, useLocation } from 'react-router-dom';
import { Suspense, useCallback, useEffect, useState } from 'react';
import './styles/App.css';
import Navbar from './components/layout/Navbar';
import Footer from './components/layout/Footer';
import AuthLayout from './components/layout/AuthLayout';
import WorkspaceLayout from './components/layout/WorkspaceLayout';
import MobileTopBar from './components/mobile/MobileTopBar';
import MobileBottomNav from './components/mobile/MobileBottomNav';
import EditProfileModal from './components/common/EditProfileModal';
import EditPortfolioModal from './components/common/EditPortfolioModal';
import ServiceProfileModal from './components/common/ServiceProfileModal';
import VerificationRequestModal from './components/common/VerificationRequestModal';
import ProtectedRoute from './components/common/ProtectedRoute';
import InitialLoadingScreen from './components/common/InitialLoadingScreen';
import lazyWithRetry from './utils/lazyWithRetry';

// Admin imports
import AdminLayout from './components/layout/AdminLayout';
import { clearAuthSession, getUser, isAuthenticated, serviceProfileAPI } from './services/api';

const Home = lazyWithRetry(() => import('./pages/Home'), 'Home');
const About = lazyWithRetry(() => import('./pages/About'), 'About');
const Login = lazyWithRetry(() => import('./pages/Login'), 'Login');
const Register = lazyWithRetry(() => import('./pages/Register'), 'Register');
const ForgotPassword = lazyWithRetry(() => import('./pages/ForgotPassword'), 'ForgotPassword');
const ResetPassword = lazyWithRetry(() => import('./pages/ResetPassword'), 'ResetPassword');
const VerifyEmail = lazyWithRetry(() => import('./pages/VerifyEmail'), 'VerifyEmail');
const Feed = lazyWithRetry(() => import('./pages/Feed'), 'Feed');
const Notifications = lazyWithRetry(() => import('./pages/Notifications'), 'Notifications');
const ServiceProviderPortfolio = lazyWithRetry(() => import('./pages/ServiceProviderPortfolio'), 'ServiceProviderPortfolio');
const ServiceProviderDashboard = lazyWithRetry(() => import('./pages/ServiceProviderDashboard'), 'ServiceProviderDashboard');
const ClientDashboard = lazyWithRetry(() => import('./pages/ClientDashboard'), 'ClientDashboard');
const ProviderSchedule = lazyWithRetry(() => import('./pages/ProviderSchedule'), 'ProviderSchedule');
const Requests = lazyWithRetry(() => import('./pages/Requests'), 'Requests');
const ClientSettings = lazyWithRetry(() => import('./pages/ClientSettings'), 'ClientSettings');
const ServiceProviderSettings = lazyWithRetry(() => import('./pages/ServiceProviderSettings'), 'ServiceProviderSettings');
const Chatbot = lazyWithRetry(() => import('./components/common/Chatbot'), 'Chatbot');
const AdminDashboard = lazyWithRetry(() => import('./pages/admin/AdminDashboard'), 'AdminDashboard');
const AdminUsers = lazyWithRetry(() => import('./pages/admin/AdminUsers'), 'AdminUsers');
const AdminVerifications = lazyWithRetry(() => import('./pages/admin/AdminVerifications'), 'AdminVerifications');
const AdminReports = lazyWithRetry(() => import('./pages/admin/AdminReports'), 'AdminReports');
const AdminSettings = lazyWithRetry(() => import('./pages/admin/AdminSettings'), 'AdminSettings');

const MOBILE_BREAKPOINT_PX = 768;

function InitialLoadReady({ onReady }) {
  useEffect(() => {
    onReady();
  }, [onReady]);

  return null;
}

function App() {
  const location = useLocation();
  const [isChatbotOpen, setIsChatbotOpen] = useState(false);
  const [currentUser, setCurrentUser] = useState(getUser());
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
  const [hasCompletedInitialLoad, setHasCompletedInitialLoad] = useState(false);

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

  const isMobileAuthenticated = Boolean(
    isMobileViewport
    && currentUser
    && ['client', 'tradesperson'].includes(currentUser.userType)
    && isAuthenticated()
  );
  useEffect(() => {
    window.scrollTo({ top: 0, left: 0, behavior: 'auto' });
    document.documentElement.scrollTop = 0;
    document.body.scrollTop = 0;

    const frame = window.requestAnimationFrame(() => {
      document.querySelectorAll('.workspace-content, .admin-content, .mobile-page-content').forEach((element) => {
        element.scrollTop = 0;
      });
    });

    return () => window.cancelAnimationFrame(frame);
  }, [location.pathname]);

  const shouldLiftChatbotButton = isMobileAuthenticated && location.pathname.startsWith('/provider/');
  const isMobileShellLayout = isMobileViewport;
  const hideChatbotOnRoute = location.pathname === '/about';
  const isPublicProviderRoute = /^\/provider\/[^/]+\/?$/.test(location.pathname);
  const workspaceRoutes = currentUser?.userType === 'tradesperson'
    ? ['/dashboard', '/requests', '/provider-settings', '/provider-schedule', '/provider-availability', '/provider-credentials', '/notifications']
    : currentUser?.userType === 'client'
      ? ['/client-dashboard', '/feed', '/requests', '/client-settings', '/notifications']
      : [];
  const isAuthenticatedWorkspace = Boolean(
    currentUser
    && ['client', 'tradesperson'].includes(currentUser.userType)
    && isAuthenticated()
    && (workspaceRoutes.includes(location.pathname) || isPublicProviderRoute)
  );
  const shouldShowPublicFooter = !isAuthenticatedWorkspace && (
    ['/', '/about', '/feed'].includes(location.pathname)
    || isPublicProviderRoute
  );

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
    clearAuthSession({ preserveRedirect: false });
    setMobileProfileMenuOpen(false);
  };

  const handleInitialLoadReady = useCallback(() => {
    setHasCompletedInitialLoad(true);
  }, []);

  const appLoadingFallback = hasCompletedInitialLoad ? (
    <div className="text-center py-4">Loading...</div>
  ) : (
    <InitialLoadingScreen />
  );

  const publicShell = (
    <div className={`app ${isMobileShellLayout ? 'mobile-shell-layout' : ''} ${isMobileAuthenticated ? 'mobile-auth-layout' : ''} ${isAuthenticatedWorkspace ? 'authenticated-workspace-active' : ''}`.trim()}>
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

      <div className={`desktop-public-navbar ${isMobileShellLayout ? 'desktop-navbar-hidden' : ''}`.trim()}>
        <Navbar />
      </div>

      <main className={`main-content ${isMobileShellLayout ? 'mobile-page-content' : ''} ${isMobileAuthenticated ? 'authenticated-page-content' : ''}`}>
        {isAuthenticatedWorkspace ? (
          <WorkspaceLayout
            role={currentUser?.userType}
            hasServiceProfile={hasServiceProfile}
            publicProfileRoute={providerPublicProfileRoute}
          >
            <Outlet />
          </WorkspaceLayout>
        ) : (
          <Outlet />
        )}
      </main>

      {isMobileShellLayout && (
        <MobileBottomNav
          role={mobileRole}
          profileMenuOpen={mobileProfileMenuOpen}
          onProfileTap={mobileProfileMenuOpen ? handleCloseMobileProfileMenu : handleOpenMobileProfileMenu}
        />
      )}

      {shouldShowPublicFooter && (
        <Footer className="public-route-footer" />
      )}

      {!hideChatbotOnRoute && (
        <>
          <button
            className={`floating-btn ${shouldLiftChatbotButton ? 'floating-btn-avoid-sticky' : ''}`.trim()}
            onClick={() => setIsChatbotOpen(true)}
            aria-label="Open chat support"
          >
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"></path>
            </svg>
          </button>

          <Chatbot isOpen={isChatbotOpen} onClose={() => setIsChatbotOpen(false)} />
        </>
      )}

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
  );

  return (
    <>
      <Suspense fallback={appLoadingFallback}>
        <Routes>
          {/* Admin Routes - No regular Navbar/Footer */}
          <Route
            path="/admin"
            element={(
              <ProtectedRoute allowedRoles={['admin']}>
                <AdminLayout />
              </ProtectedRoute>
            )}
          >
            <Route index element={<AdminDashboard />} />
            <Route path="dashboard" element={<AdminDashboard />} />
            <Route path="users" element={<AdminUsers />} />
            <Route path="verifications" element={<AdminVerifications />} />
            <Route path="reports" element={<AdminReports />} />
            <Route path="settings" element={<AdminSettings />} />
          </Route>

          {/* Authentication Routes - Focused layout without public navigation/footer */}
          <Route element={<AuthLayout />}>
            <Route path="/login" element={<Login />} />
            <Route path="/register" element={<Register />} />
            <Route path="/forgot-password" element={<ForgotPassword />} />
            <Route path="/reset-password/:token" element={<ResetPassword />} />
            <Route path="/verify-email" element={<VerifyEmail />} />
          </Route>

          {/* Public and authenticated user routes - Existing application shell preserved */}
          <Route element={publicShell}>
            <Route path="/" element={<Home />} />
            <Route path="/about" element={<About />} />
            <Route path="/feed" element={<Feed />} />
            <Route
              path="/notifications"
              element={(
                <ProtectedRoute allowedRoles={['client', 'tradesperson', 'admin']}>
                  <Notifications />
                </ProtectedRoute>
              )}
            />
            <Route
              path="/dashboard"
              element={(
                <ProtectedRoute allowedRoles={['tradesperson']}>
                  <ServiceProviderDashboard />
                </ProtectedRoute>
              )}
            />
            <Route
              path="/client-dashboard"
              element={(
                <ProtectedRoute allowedRoles={['client']}>
                  <ClientDashboard />
                </ProtectedRoute>
              )}
            />
            <Route path="/provider/:id" element={<ServiceProviderPortfolio />} />
            <Route
              path="/requests"
              element={(
                <ProtectedRoute allowedRoles={['client', 'tradesperson']}>
                  <Requests />
                </ProtectedRoute>
              )}
            />
            <Route
              path="/client-settings"
              element={(
                <ProtectedRoute allowedRoles={['client']}>
                  <ClientSettings />
                </ProtectedRoute>
              )}
            />
            <Route
              path="/provider-settings"
              element={(
                <ProtectedRoute allowedRoles={['tradesperson']}>
                  <ServiceProviderSettings />
                </ProtectedRoute>
              )}
            />
            <Route
              path="/provider-schedule"
              element={(
                <ProtectedRoute allowedRoles={['tradesperson']}>
                  <ProviderSchedule />
                </ProtectedRoute>
              )}
            />
            <Route
              path="/provider-availability"
              element={(
                <ProtectedRoute allowedRoles={['tradesperson']}>
                  <ServiceProviderSettings />
                </ProtectedRoute>
              )}
            />
            <Route
              path="/provider-credentials"
              element={(
                <ProtectedRoute allowedRoles={['tradesperson']}>
                  <ServiceProviderSettings />
                </ProtectedRoute>
              )}
            />
          </Route>
        </Routes>
        {!hasCompletedInitialLoad && <InitialLoadReady onReady={handleInitialLoadReady} />}
      </Suspense>

    </>
  );
}

export default App;
