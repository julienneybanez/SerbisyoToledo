import { useEffect, useState } from 'react';
import { adminAPI } from '../../services/api';
import '../../styles/AdminPages.css';

function AdminVerifications() {
  const [searchTerm, setSearchTerm] = useState('');
  const [filterStatus, setFilterStatus] = useState('pending');
  const [verifications, setVerifications] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [actionLoading, setActionLoading] = useState(null);

  const fetchVerifications = async () => {
    try {
      setLoading(true);
      setError('');
      const response = await adminAPI.getVerificationRequests();
      if (response.success) {
        setVerifications(response.data || []);
      }
    } catch (err) {
      setError(err.message || 'Failed to load verification requests');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchVerifications();
  }, []);

  const handleReview = async (requestId, action) => {
    try {
      setActionLoading(`${requestId}-${action}`);
      let payload = { action };

      if (action === 'reject') {
        const reason = window.prompt('Enter rejection reason:');
        if (!reason) return;
        payload = { ...payload, rejectionReason: reason };
      }

      const response = await adminAPI.reviewVerificationRequest(requestId, payload);
      if (response.success) {
        await fetchVerifications();
      }
    } catch (err) {
      alert(err.message || 'Failed to review request');
    } finally {
      setActionLoading(null);
    }
  };

  const openDocument = (dataUrl) => {
    if (!dataUrl) {
      alert('No document available.');
      return;
    }
    window.open(dataUrl, '_blank', 'noopener,noreferrer');
  };

  const filteredVerifications = verifications.filter((v) => {
    const query = searchTerm.trim().toLowerCase();
    const matchesSearch =
      !query ||
      v.fullName.toLowerCase().includes(query) ||
      v.email.toLowerCase().includes(query) ||
      (v.profession || '').toLowerCase().includes(query);

    const matchesStatus = filterStatus === 'all' || v.status === filterStatus;
    return matchesSearch && matchesStatus;
  });

  const pendingCount = verifications.filter((v) => v.status === 'pending').length;
  const approvedCount = verifications.filter((v) => v.status === 'approved').length;
  const rejectedCount = verifications.filter((v) => v.status === 'rejected').length;

  return (
    <div className="admin-page">
      <div className="admin-page-header">
        <h1 className="admin-page-title">Verification Requests</h1>
        <p className="admin-page-subtitle">Review and manage service provider verification requests</p>
      </div>

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

      {error && <div className="alert alert-danger mt-3">{error}</div>}

      <div className="requests-list">
        {loading ? (
          <div className="text-center py-4">Loading verification requests...</div>
        ) : (
          filteredVerifications.map((request) => (
            <div key={request.id} className={`request-card verification-card ${request.status !== 'pending' ? 'processed' : ''}`}>
              <div className="request-avatar">
                <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
                  <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"></path>
                  <circle cx="12" cy="7" r="4"></circle>
                </svg>
              </div>

              <div className="request-info">
                <div className="request-header">
                  <h4 className="request-name">{request.fullName}</h4>
                  {request.profession && <span className="document-tag">{request.profession}</span>}
                  <span className={`status-badge status-${request.status === 'approved' ? 'verified' : request.status === 'rejected' ? 'suspended' : 'pending'}`}>
                    {request.status}
                  </span>
                </div>

                <p className="request-detail">Email: {request.email}</p>
                <p className="request-detail">Phone: {request.phoneNumber}</p>
                <p className="request-detail">Address: {request.address}</p>
                <p className="request-detail">Submitted: {new Date(request.createdAt).toLocaleString()}</p>
                <p className="request-detail">Service Details: {request.serviceDescription}</p>

                {request.rejectionReason && (
                  <p className="rejection-reason"><strong>Rejection Reason:</strong> {request.rejectionReason}</p>
                )}

                <div className="request-documents">
                  <button className="btn-view-details" onClick={() => openDocument(request.documents?.governmentId)}>
                    View Government ID
                  </button>
                  <button className="btn-view-details" onClick={() => openDocument(request.documents?.certifications)}>
                    View Certifications
                  </button>
                </div>
              </div>

              <div className="request-actions">
                {request.status === 'pending' ? (
                  <>
                    <button
                      className="btn-approve"
                      disabled={actionLoading === `${request.id}-approve`}
                      onClick={() => handleReview(request.id, 'approve')}
                    >
                      {actionLoading === `${request.id}-approve` ? 'Approving...' : 'Approve'}
                    </button>
                    <button
                      className="btn-reject"
                      disabled={actionLoading === `${request.id}-reject`}
                      onClick={() => handleReview(request.id, 'reject')}
                    >
                      {actionLoading === `${request.id}-reject` ? 'Rejecting...' : 'Reject'}
                    </button>
                  </>
                ) : (
                  <button className="btn-view-details" onClick={() => openDocument(request.documents?.governmentId)}>
                    View Details
                  </button>
                )}
              </div>
            </div>
          ))
        )}
      </div>

      {!loading && filteredVerifications.length === 0 && (
        <div className="empty-state">
          <h3>No verification requests found</h3>
          <p>Try adjusting your search or filter criteria</p>
        </div>
      )}
    </div>
  );
}

export default AdminVerifications;
