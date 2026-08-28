import WorkspaceSidebar from './WorkspaceSidebar';
import WorkspaceTopbar from './WorkspaceTopbar';
import '../../styles/WorkspaceLayout.css';

export default function WorkspaceLayout({
  role,
  children,
  hasServiceProfile = false,
  publicProfileRoute = '/dashboard',
  onEditClientProfile,
  onEditProviderProfile,
  onManageServiceProfile,
}) {
  return (
    <div className="workspace-shell">
      <WorkspaceSidebar
        role={role}
        hasServiceProfile={hasServiceProfile}
        publicProfileRoute={publicProfileRoute}
        onEditClientProfile={onEditClientProfile}
        onEditProviderProfile={onEditProviderProfile}
        onManageServiceProfile={onManageServiceProfile}
      />
      <div className="workspace-stage">
        <WorkspaceTopbar role={role} />
        <div className="workspace-content">{children}</div>
      </div>
    </div>
  );
}
