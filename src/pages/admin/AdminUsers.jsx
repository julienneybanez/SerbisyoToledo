import { useState } from 'react';
import '../../styles/AdminPages.css';

function AdminUsers() {
  const [searchTerm, setSearchTerm] = useState('');
  const [filterType, setFilterType] = useState('all');
  const [filterStatus, setFilterStatus] = useState('all');

  // Mock data - replace with API calls
  const users = [
    { id: 1, name: 'Juan Dela Cruz', email: 'juan@example.com', type: 'tradesperson', profession: 'Electrician', status: 'verified', joinDate: '2025-06-15' },
    { id: 2, name: 'Maria Santos', email: 'maria@example.com', type: 'tradesperson', profession: 'Plumber', status: 'pending', joinDate: '2025-08-20' },
    { id: 3, name: 'Ana Lopez', email: 'ana@example.com', type: 'client', profession: null, status: 'active', joinDate: '2025-09-10' },
    { id: 4, name: 'Carlos Yulo', email: 'carlos@example.com', type: 'tradesperson', profession: 'Carpenter', status: 'verified', joinDate: '2025-07-05' },
    { id: 5, name: 'Sofia Garcia', email: 'sofia@example.com', type: 'client', profession: null, status: 'active', joinDate: '2025-10-12' },
    { id: 6, name: 'Miguel Torres', email: 'miguel@example.com', type: 'tradesperson', profession: 'Painter', status: 'suspended', joinDate: '2025-05-22' },
    { id: 7, name: 'Linda Reyes', email: 'linda@example.com', type: 'client', profession: null, status: 'active', joinDate: '2025-11-08' },
    { id: 8, name: 'Jose Mendoza', email: 'jose@example.com', type: 'tradesperson', profession: 'Mason', status: 'verified', joinDate: '2025-04-18' },
  ];

  const filteredUsers = users.filter(user => {
    const matchesSearch = user.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         user.email.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesType = filterType === 'all' || user.type === filterType;
    const matchesStatus = filterStatus === 'all' || user.status === filterStatus;
    return matchesSearch && matchesType && matchesStatus;
  });

  const getStatusClass = (status) => {
    switch (status) {
      case 'verified': return 'status-verified';
      case 'active': return 'status-active';
      case 'pending': return 'status-pending';
      case 'suspended': return 'status-suspended';
      default: return '';
    }
  };

  return (
    <div className="admin-page">
      <div className="page-header">
        <h1 className="page-title">Users Management</h1>
        <p className="page-subtitle">Manage all users in the system</p>
      </div>

      {/* Filters */}
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

      {/* Users Table */}
      <div className="table-container">
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
            {filteredUsers.map(user => (
              <tr key={user.id}>
                <td>
                  <div className="user-cell">
                    <div className="user-avatar-small">
                      {user.name.split(' ').map(n => n[0]).join('')}
                    </div>
                    <div className="user-info-cell">
                      <span className="user-name">{user.name}</span>
                      <span className="user-email">{user.email}</span>
                    </div>
                  </div>
                </td>
                <td>
                  <span className={`type-badge ${user.type}`}>
                    {user.type === 'tradesperson' ? 'Provider' : 'Client'}
                  </span>
                </td>
                <td>{user.profession || '—'}</td>
                <td>
                  <span className={`status-badge ${getStatusClass(user.status)}`}>
                    {user.status}
                  </span>
                </td>
                <td>{user.joinDate}</td>
                <td>
                  <div className="table-actions">
                    <button className="action-btn view" title="View">
                      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                        <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"></path>
                        <circle cx="12" cy="12" r="3"></circle>
                      </svg>
                    </button>
                    <button className="action-btn edit" title="Edit">
                      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                        <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"></path>
                        <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"></path>
                      </svg>
                    </button>
                    <button className="action-btn delete" title="Suspend">
                      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                        <circle cx="12" cy="12" r="10"></circle>
                        <line x1="4.93" y1="4.93" x2="19.07" y2="19.07"></line>
                      </svg>
                    </button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Pagination */}
      <div className="pagination">
        <button className="pagination-btn" disabled>&lt; Previous</button>
        <div className="pagination-pages">
          <button className="pagination-page active">1</button>
          <button className="pagination-page">2</button>
          <button className="pagination-page">3</button>
          <span>...</span>
          <button className="pagination-page">10</button>
        </div>
        <button className="pagination-btn">Next &gt;</button>
      </div>
    </div>
  );
}

export default AdminUsers;
