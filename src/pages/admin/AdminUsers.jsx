import { useEffect, useState } from 'react';
import { adminAPI } from '../../services/api';
import '../../styles/AdminPages.css';

function AdminUsers() {
  const [searchTerm, setSearchTerm] = useState('');
  const [filterType, setFilterType] = useState('all');
  const [filterStatus, setFilterStatus] = useState('all');
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [actionLoading, setActionLoading] = useState('');

  const fetchUsers = async () => {
    try {
      setLoading(true);
      setError('');
      const response = await adminAPI.getAllUsers();
      if (response.success) {
        setUsers(response.data || []);
      }
    } catch (err) {
      setError(err.message || 'Failed to load users');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchUsers();
  }, []);

  const handleViewDetails = async (userId) => {
    try {
      const response = await adminAPI.getUserById(userId);
      if (response.success) {
        const u = response.data;
        alert(
          [
            `Name: ${u.name}`,
            `Email: ${u.email}`,
            `Type: ${u.type}`,
            `Profession: ${u.profession || 'N/A'}`,
            `Phone: ${u.phone || 'N/A'}`,
            `Address: ${u.address || 'N/A'}`,
            `Verified: ${u.isVerified ? 'Yes' : 'No'}`,
            `Active: ${u.isActive ? 'Yes' : 'No'}`,
          ].join('\n')
        );
      }
    } catch (err) {
      alert(err.message || 'Failed to fetch user details');
    }
  };

  const handleToggleActive = async (user) => {
    try {
      setActionLoading(`active-${user.id}`);
      const response = await adminAPI.updateUserStatus(user.id, { isActive: !user.isActive });
      if (response.success) {
        await fetchUsers();
      }
    } catch (err) {
      alert(err.message || 'Failed to update user status');
    } finally {
      setActionLoading('');
    }
  };

  const handleToggleVerification = async (user) => {
    if (user.type !== 'tradesperson') return;

    try {
      setActionLoading(`verify-${user.id}`);
      const response = await adminAPI.updateUserStatus(user.id, { isVerified: !user.isVerified });
      if (response.success) {
        await fetchUsers();
      }
    } catch (err) {
      alert(err.message || 'Failed to update verification status');
    } finally {
      setActionLoading('');
    }
  };

  const handleViewActivity = async (userId) => {
    try {
      const response = await adminAPI.getUserActivity(userId);
      if (response.success) {
        const summary = response.data.summary;
        alert(
          [
            `Total Requests: ${summary.totalRequests}`,
            `Completed Requests: ${summary.completedRequests}`,
            `Active Requests: ${summary.activeRequests}`,
            `Reports Submitted: ${summary.reportsSubmitted}`,
            `Reports Received: ${summary.reportsReceived}`,
            `Last Request Activity: ${summary.lastRequestActivity || 'N/A'}`,
            `Last Report Activity: ${summary.lastReportActivity || 'N/A'}`,
          ].join('\n')
        );
      }
    } catch (err) {
      alert(err.message || 'Failed to fetch user activity');
    }
  };

  const filteredUsers = users.filter((user) => {
    const query = searchTerm.trim().toLowerCase();
    const matchesSearch =
      !query ||
      user.name.toLowerCase().includes(query) ||
      user.email.toLowerCase().includes(query);

    const matchesType = filterType === 'all' || user.type === filterType;
    const matchesStatus =
      filterStatus === 'all' ||
      (filterStatus === 'active' && user.isActive && !user.isVerified) ||
      (filterStatus === 'verified' && user.isVerified) ||
      (filterStatus === 'pending' && !user.isVerified && user.isActive) ||
      (filterStatus === 'suspended' && !user.isActive);

    return matchesSearch && matchesType && matchesStatus;
  });

  return (
    <div className="admin-page">
      <div className="admin-page-header">
        <h1 className="admin-page-title">Users Management</h1>
        <p className="admin-page-subtitle">Manage all users in the system</p>
      </div>

      <div className="filters-bar">
        <div className="search-box">
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <circle cx="11" cy="11" r="8"></circle>
            <line x1="21" y1="21" x2="16.65" y2="16.65"></line>
          </svg>
          <input
            type="text"
            placeholder="Search users..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
          />
        </div>

        <div className="filter-group">
          <select value={filterType} onChange={(e) => setFilterType(e.target.value)}>
            <option value="all">All Types</option>
            <option value="client">Clients</option>
            <option value="tradesperson">Service Providers</option>
            <option value="admin">Admins</option>
          </select>

          <select value={filterStatus} onChange={(e) => setFilterStatus(e.target.value)}>
            <option value="all">All Status</option>
            <option value="active">Active</option>
            <option value="verified">Verified</option>
            <option value="pending">Pending</option>
            <option value="suspended">Suspended</option>
          </select>
        </div>
      </div>

      {error && <div className="alert alert-danger mt-3">{error}</div>}

      <div className="table-container">
        {loading ? (
          <div className="text-center py-4">Loading users...</div>
        ) : (
          <table className="admin-table">
            <thead>
              <tr>
                <th>User</th>
                <th>Type</th>
                <th>Profession</th>
                <th>Status</th>
                <th>Join Date</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {filteredUsers.map((user) => (
                <tr key={user.id}>
                  <td>
                    <div className="user-cell">
                      <div className="user-avatar-small">
                        {user.name.split(' ').map((n) => n[0]).join('').slice(0, 2)}
                      </div>
                      <div className="user-info-cell">
                        <span className="user-name">{user.name}</span>
                        <span className="user-email">{user.email}</span>
                      </div>
                    </div>
                  </td>
                  <td>
                    <span className={`type-badge ${user.type}`}>
                      {user.type === 'tradesperson' ? 'Provider' : user.type}
                    </span>
                  </td>
                  <td>{user.profession || '—'}</td>
                  <td>
                    <span className={`status-badge ${!user.isActive ? 'status-suspended' : user.isVerified ? 'status-verified' : 'status-pending'}`}>
                      {!user.isActive ? 'suspended' : user.isVerified ? 'verified' : 'active'}
                    </span>
                  </td>
                  <td>{new Date(user.joinDate).toLocaleDateString()}</td>
                  <td>
                    <div className="table-actions table-actions-stack">
                      <button className="btn-view-details btn-users-action" onClick={() => handleViewDetails(user.id)}>
                        View Details
                      </button>
                      <button
                        className="btn-dismiss btn-users-action"
                        disabled={actionLoading === `active-${user.id}`}
                        onClick={() => handleToggleActive(user)}
                      >
                        {actionLoading === `active-${user.id}`
                          ? 'Updating...'
                          : user.isActive
                            ? 'Deactivate'
                            : 'Reactivate'}
                      </button>
                      {user.type === 'tradesperson' && (
                        <button
                          className="btn-investigate"
                          disabled={actionLoading === `verify-${user.id}`}
                          onClick={() => handleToggleVerification(user)}
                        >
                          {actionLoading === `verify-${user.id}`
                            ? 'Updating...'
                            : user.isVerified
                              ? 'Unverify Provider'
                              : 'Verify Provider'}
                        </button>
                      )}
                      <button className="btn-approve" onClick={() => handleViewActivity(user.id)}>
                        View Activity
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}

export default AdminUsers;
