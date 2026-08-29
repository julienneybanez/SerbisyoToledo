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
import ProtectedRoute, { RoleAwarePublicRoute } from './components/common/ProtectedRoute';
import InitialLoadingScreen from './components/common/InitialLoadingScreen';
import lazyWithRetry from './utils/lazyWithRetry';
import { useLanguage } from './context/LanguageContext';
import { isPublicProviderRoute, shouldShowChatbotForContext } from './utils/chatbotVisibility';

// Admin imports
import AdminLayout from './components/layout/AdminLayout';
import { authAPI, getUser, isAuthenticated, serviceProfileAPI } from './services/api';
import { connectMessagingSocket, disconnectMessagingSocket } from './services/socket';

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
const ProviderAvailability = lazyWithRetry(() => import('./pages/ProviderAvailability'), 'ProviderAvailability');
const Requests = lazyWithRetry(() => import('./pages/Requests'), 'Requests');
const Messages = lazyWithRetry(() => import('./pages/Messages'), 'Messages');
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
  const { t } = useLanguage();
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
    let mounted = true;

    authAPI.getMe()
      .then((response) => {
        if (mounted && response?.success && response.data?.user) {
          setCurrentUser(response.data.user);
        }
      })
      .catch(() => {
        if (mounted) {
          setCurrentUser(getUser());
        }
      });

    return () => {
      mounted = false;
    };
  }, []);

  useEffect(() => {
    if (!currentUser || !['client', 'tradesperson'].includes(currentUser.userType)) {
      disconnectMessagingSocket();
      return undefined;
    }

    connectMessagingSocket();
    return () => disconnectMessagingSocket();
    // Depend on primitive id/userType instead of the currentUser object reference
    // to avoid reconnecting the socket on every unrelated re-render.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentUser?.id, currentUser?.userType]);

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
    const handleProfileCreated = () => {
      if (currentUser?.userType !== 'tradesperson') return;

      serviceProfileAPI.getMyProfile()
        .then((response) => {
          const hasProfile = Boolean(response?.success && response?.data?.id);
          setHasServiceProfile(hasProfile);
          setProviderPublicProfileRoute(hasProfile ? `/provider/${response.data.id}` : '/dashboard');
        })
        .catch(() => {});
    };

    window.addEventListener('profileCreated', handleProfileCreated);
    return () => window.removeEventListener('profileCreated', handleProfileCreated);
  }, [currentUser]);

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

  const isMobileShellLayout = isMobileViewport;
  const providerPublicRoute = isPublicProviderRoute(location.pathname);
  const shouldShowChatbot = shouldShowChatbotForContext({
    pathname: location.pathname,
    userType: currentUser?.userType || null,
  });
  const shouldLiftChatbotButton = isMobileAuthenticated && providerPublicRoute;
  const workspaceRoutes = currentUser?.userType === 'tradesperson'
    ? ['/dashboard', '/requests', '/messages', '/provider-settings', '/provider-schedule', '/provider-availability', '/provider-credentials', '/notifications']
    : currentUser?.userType === 'client'
      ? ['/client-dashboard', '/feed', '/requests', '/messages', '/client-settings', '/notifications']
      : [];
  const isAuthenticatedWorkspace = Boolean(
    currentUser
    && ['client', 'tradesperson'].includes(currentUser.userType)
    && isAuthenticated()
    && (workspaceRoutes.includes(location.pathname) || providerPublicRoute)
  );
  const shouldShowPublicFooter = !isAuthenticatedWorkspace && (
    ['/', '/about', '/feed'].includes(location.pathname)
    || providerPublicRoute
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

  const handleMobileLogout = async () => {
    await authAPI.logout();
    setCurrentUser(null);
    setMobileProfileMenuOpen(false);
  };

  const handleManageServiceProfile = useCallback(async () => {
    setMobileProfileMenuOpen(false);

    if (hasServiceProfile) {
      setShowMobileServiceProfile(true);
      return;
    }

    let latestUser = currentUser;

    try {
      const response = await authAPI.getMe();
      if (response?.success && response.data?.user) {
        latestUser = response.data.user;
        setCurrentUser(latestUser);
      }
    } catch {
      // The backend creation endpoint still enforces verification.
    }

    if (!latestUser?.isVerified) {
      setShowMobileVerificationRequest(true);
      return;
    }

    setShowMobileServiceProfile(true);
  }, [currentUser, hasServiceProfile]);

  useEffect(() => {
    if (!shouldShowChatbot && isChatbotOpen) {
      setIsChatbotOpen(false);
    }
  }, [isChatbotOpen, shouldShowChatbot]);

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
          onManageServiceProfile={handleManageServiceProfile}
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
            onEditClientProfile={() => setShowMobileEditProfile(true)}
            onEditProviderProfile={() => setShowMobileEditPortfolio(true)}
            onManageServiceProfile={handleManageServiceProfile}
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

      {shouldShowChatbot && (
        <>
          <button
            className={`floating-btn ${shouldLiftChatbotButton ? 'floating-btn-avoid-sticky' : ''}`.trim()}
            onClick={() => setIsChatbotOpen(true)}
            aria-label={t('openAssistant')}
          >
            <i className="bi bi-chat-dots-fill" aria-hidden="true"></i>
          </button>

          <Chatbot
            isOpen={isChatbotOpen}
            onClose={() => setIsChatbotOpen(false)}
            context={{
              route: location.pathname,
              role: currentUser?.userType || 'guest',
            }}
          />
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
            <Route path="verifications" element={<AdminVerifications mode="verifications" />} />
            <Route path="credentials" element={<AdminVerifications mode="credentials" />} />
            <Route path="reports" element={<AdminReports />} />
            <Route path="settings" element={<AdminSettings />} />
          </Route>

          {/* Authentication Routes - Focused layout without public navigation/footer */}
          <Route element={<AuthLayout />}>
            <Route path="/login" element={<RoleAwarePublicRoute><Login /></RoleAwarePublicRoute>} />
            <Route path="/register" element={<RoleAwarePublicRoute><Register /></RoleAwarePublicRoute>} />
            <Route path="/forgot-password" element={<ForgotPassword />} />
            <Route path="/reset-password/:token" element={<ResetPassword />} />
            <Route path="/verify-email" element={<VerifyEmail />} />
          </Route>

          {/* Public and authenticated user routes - Existing application shell preserved */}
          <Route element={publicShell}>
            <Route path="/" element={<RoleAwarePublicRoute><Home /></RoleAwarePublicRoute>} />
            <Route path="/about" element={<RoleAwarePublicRoute><About /></RoleAwarePublicRoute>} />
            <Route path="/feed" element={<RoleAwarePublicRoute allowedAuthenticatedRoles={['client']}><Feed /></RoleAwarePublicRoute>} />
            <Route
              path="/notifications"
              element={(
                <ProtectedRoute allowedRoles={['client', 'tradesperson']}>
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
            <Route
              path="/provider/:id"
              element={(
                <RoleAwarePublicRoute allowedAuthenticatedRoles={['client', 'tradesperson']}>
                  <ServiceProviderPortfolio />
                </RoleAwarePublicRoute>
              )}
            />
            <Route
              path="/requests"
              element={(
                <ProtectedRoute allowedRoles={['client', 'tradesperson']}>
                  <Requests />
                </ProtectedRoute>
              )}
            />
            <Route
              path="/messages"
              element={(
                <ProtectedRoute allowedRoles={['client', 'tradesperson']}>
                  <Messages />
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
                  <ProviderAvailability />
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
