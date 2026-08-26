import ProviderSidebar from './ProviderSidebar';
import '../../styles/ProviderWorkspace.css';

function ProviderLayout({ children, hasServiceProfile = false, publicProfileRoute = '/dashboard' }) {
  return (
    <div className="provider-workspace-layout">
      <ProviderSidebar
        hasServiceProfile={hasServiceProfile}
        publicProfileRoute={publicProfileRoute}
      />
      <div className="provider-workspace-main">
        {children}
      </div>
    </div>
  );
}

export default ProviderLayout;
