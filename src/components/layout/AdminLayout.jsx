import { useCallback, useState } from 'react';
import { Outlet, useNavigate } from 'react-router-dom';
import { authAPI, getUser } from '../../services/api';
import AdminNavbar from './AdminNavbar';
import AdminSidebar from './AdminSidebar';
import AdminFooter from './AdminFooter';
import MobileTopBar from '../mobile/MobileTopBar';
import MobileBottomNav from '../mobile/MobileBottomNav';
import '../../styles/AdminLayout.css';

function AdminLayout() {
  const navigate = useNavigate();
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [mobileProfileMenuOpen, setMobileProfileMenuOpen] = useState(false);
  const user = getUser();

  const toggleSidebar = () => {
    setSidebarOpen(!sidebarOpen);
  };

  const handleToggleMobileProfileMenu = useCallback(() => {
    setMobileProfileMenuOpen((prev) => !prev);
  }, []);

  const handleCloseMobileProfileMenu = useCallback(() => {
    setMobileProfileMenuOpen(false);
  }, []);

  const handleLogout = async () => {
    await authAPI.logout();
    window.dispatchEvent(new Event('authChange'));
    setMobileProfileMenuOpen(false);
    navigate('/login', { replace: true });
  };

  return (
    <div className="admin-layout mobile-auth-layout admin-mobile-layout">
      <AdminSidebar isOpen={sidebarOpen} onClose={() => setSidebarOpen(false)} />
      
      <div className="admin-main">
        <div className="admin-mobile-topbar-wrap">
          <MobileTopBar
            user={user}
            role="admin"
            onMenu={toggleSidebar}
            profileRoute="/admin/settings"
            settingsRoute="/admin/settings"
            profileMenuOpen={mobileProfileMenuOpen}
            onToggleProfileMenu={handleToggleMobileProfileMenu}
            onCloseProfileMenu={handleCloseMobileProfileMenu}
            onLogout={handleLogout}
          />
        </div>
        <div className="admin-desktop-navbar-wrap">
          <AdminNavbar onToggleSidebar={toggleSidebar} isSidebarOpen={sidebarOpen} />
        </div>
        
        <main className="admin-content authenticated-page-content">
          <Outlet />
        </main>

        <MobileBottomNav role="admin" />
        
        <AdminFooter />
      </div>
    </div>
  );
}

export default AdminLayout;
