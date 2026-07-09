import { useState } from 'react';
import '../../styles/AdminPages.css';

function AdminVerifications() {
  const [searchTerm, setSearchTerm] = useState('');
  const [filterStatus, setFilterStatus] = useState('pending');

  // Mock data - replace with API calls
  const verifications = [
    {
      id: 1,
      name: 'Juan Dela Cruz',
      profession: 'Electrician',
      email: 'juan@example.com',
      phone: '+63 987 523 312',
      submittedDate: '2026-01-21',
      status: 'pending',
      documents: ['Valid ID', 'Certificate', 'Portfolio'],
      experience: '5 years',
      address: 'Toledo City, Cebu'
    },
    {
      id: 2,
      name: 'Maria Santos',
      profession: 'Plumber',
      email: 'maria@example.com',
      phone: '+63 988 854 212',
      submittedDate: '2026-01-22',
      status: 'pending',
      documents: ['Valid ID', 'License', 'Portfolio'],
      experience: '3 years',
      address: 'Toledo City, Cebu'
    },
    {
      id: 3,
      name: 'Marie Pando',
      profession: 'Carpenter',
      email: 'marie@example.com',
      phone: '+63 957 834 092',
      submittedDate: '2026-01-23',
      status: 'pending',
      documents: ['Valid ID', 'Certificate', 'Portfolio'],
      experience: '7 years',
      address: 'Toledo City, Cebu'
    },
    {
      id: 4,
      name: 'Pedro Gonzales',
      profession: 'Painter',
      email: 'pedro@example.com',
      phone: '+63 912 345 678',
      submittedDate: '2026-01-15',
      status: 'approved',
      documents: ['Valid ID', 'Portfolio'],
      experience: '4 years',
      address: 'Toledo City, Cebu'
    },
    {
      id: 5,
      name: 'Rosa Martinez',
      profession: 'Cleaner',
      email: 'rosa@example.com',
      phone: '+63 923 456 789',
      submittedDate: '2026-01-10',
      status: 'rejected',
      documents: ['Valid ID'],
      experience: '1 year',
      address: 'Toledo City, Cebu',
      rejectionReason: 'Incomplete documents'
    }
  ];

  const filteredVerifications = verifications.filter(v => {
    const matchesSearch = v.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         v.email.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         v.profession.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesStatus = filterStatus === 'all' || v.status === filterStatus;
    return matchesSearch && matchesStatus;
  });

  const getProfessionClass = (profession) => {
    switch (profession.toLowerCase()) {
      case 'electrician': return 'profession-electrician';
      case 'plumber': return 'profession-plumber';
      case 'carpenter': return 'profession-carpenter';
      case 'painter': return 'profession-painter';
      case 'cleaner': return 'profession-cleaner';
      default: return '';
    }
  };

  const getStatusClass = (status) => {
    switch (status) {
      case 'pending': return 'status-pending';
      case 'approved': return 'status-verified';
      case 'rejected': return 'status-suspended';
      default: return '';
    }
  };

  const pendingCount = verifications.filter(v => v.status === 'pending').length;
  const approvedCount = verifications.filter(v => v.status === 'approved').length;
  const rejectedCount = verifications.filter(v => v.status === 'rejected').length;

  return (
    <div className="admin-page">
      <div className="page-header">
        <h1 className="page-title">Verification Requests</h1>
        <p className="page-subtitle">Review and manage service provider verification requests</p>
      </div>

      {/* Stats Summary */}
      <div className="mini-stats">
        <div className="mini-stat">
          <span className="mini-stat-value text-warning">{pendingCount}</span>
          <span className="mini-stat-label">Pending</span>
        </div>
        <div className="mini-stat">
          <span className="mini-stat-value text-success">{approvedCount}</span>
          <span className="mini-stat-label">Approved</span>
        </div>
        <div className="mini-stat">
          <span className="mini-stat-value text-danger">{rejectedCount}</span>
          <span className="mini-stat-label">Rejected</span>
        </div>
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
            placeholder="Search by name, email, or profession..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
          />
        </div>

        <div className="filter-group">
          <select value={filterStatus} onChange={(e) => setFilterStatus(e.target.value)}>
            <option value="all">All Status</option>
            <option value="pending">Pending</option>
            <option value="approved">Approved</option>
            <option value="rejected">Rejected</option>
          </select>
        </div>
      </div>

      {/* Verification Cards */}
      <div className="requests-list">
        {filteredVerifications.map((request) => (
          <div key={request.id} className={`request-card verification-card ${request.status !== 'pending' ? 'processed' : ''}`}>
            <div className="request-avatar">
              <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
                <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"></path>
                <circle cx="12" cy="7" r="4"></circle>
              </svg>
            </div>
            
            <div className="request-info">
              <div className="request-header">
                <h4 className="request-name">{request.name}</h4>
                <span className={`profession-badge ${getProfessionClass(request.profession)}`}>
                  {request.profession}
                </span>
                {request.status !== 'pending' && (
                  <span className={`status-badge ${getStatusClass(request.status)}`}>
                    {request.status}
                  </span>
                )}
              </div>
              <p className="request-detail">Email: {request.email}</p>
              <p className="request-detail">Submitted: {request.submittedDate}</p>
              <p className="request-detail">Experience: {request.experience}</p>
              <div className="request-documents">
                {request.documents.map((doc, idx) => (
                  <span key={idx} className="document-tag">{doc}</span>
                ))}
              </div>
              {request.rejectionReason && (
                <p className="rejection-reason">
                  <strong>Rejection Reason:</strong> {request.rejectionReason}
                </p>
              )}
            </div>

            <div className="request-contact">
              <p>Phone: {request.phone}</p>
              <p>Location: {request.address}</p>
            </div>

            <div className="request-actions">
              {request.status === 'pending' ? (
                <>
                  <button className="btn-approve">
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                      <polyline points="20 6 9 17 4 12"></polyline>
                    </svg>
                    Approve
                  </button>
                  <button className="btn-reject">
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                      <line x1="18" y1="6" x2="6" y2="18"></line>
                      <line x1="6" y1="6" x2="18" y2="18"></line>
                    </svg>
                    Reject
                  </button>
                </>
              ) : (
                <button className="btn-view-details">View Details</button>
              )}
            </div>
          </div>
        ))}
      </div>

      {filteredVerifications.length === 0 && (
        <div className="empty-state">
          <svg width="64" height="64" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1">
            <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"></path>
            <polyline points="22 4 12 14.01 9 11.01"></polyline>
          </svg>
          <h3>No verification requests found</h3>
          <p>Try adjusting your search or filter criteria</p>
        </div>
      )}
    </div>
  );
}

export default AdminVerifications;
