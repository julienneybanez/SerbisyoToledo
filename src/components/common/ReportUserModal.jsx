import { useState } from 'react';
import { createPortal } from 'react-dom';
import { serviceRequestAPI } from '../../services/api';
import './ServiceProfileModal.css';

export default function ReportUserModal({ request, isProvider, onClose, onSubmitted }) {
  const [reason, setReason] = useState('');
  const [description, setDescription] = useState('');
  const [screenshot, setScreenshot] = useState(null);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');

  const reportedUserId = isProvider ? request.client_id : request.provider_id;
  const reportedUserName = isProvider ? request.client_name : request.provider_name;

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');

    if (!reason.trim() || !description.trim()) {
      setError('Please provide both reason and description.');
      return;
    }

    try {
      setSubmitting(true);
      const formData = new FormData();
      formData.append('reportedUserId', String(reportedUserId));
      formData.append('reason', reason.trim());
      formData.append('description', description.trim());
      if (screenshot) {
        formData.append('screenshot', screenshot);
      }

      const response = await serviceRequestAPI.createReport(request.id, formData);
      if (response.success) {
        onSubmitted?.();
        onClose();
      }
    } catch (err) {
      setError(err.message || 'Failed to submit report.');
    } finally {
      setSubmitting(false);
    }
  };

  return createPortal(
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-content" onClick={(e) => e.stopPropagation()}>
        <button className="modal-close" onClick={onClose} aria-label="Close report user modal">×</button>

        <form onSubmit={handleSubmit} className="service-profile-form" noValidate>
          <div className="modal-header">
            <h2 className="modal-title">Report User</h2>
            <p className="modal-subtitle">
              You are reporting {reportedUserName}. Reports are reviewed by admins and actions will be based on submitted details.
            </p>
          </div>

          {error && <div className="alert alert-error">{error}</div>}

          <section className="form-section">
            <div className="form-group">
              <label htmlFor="reason" className="form-label">Reason<span className="required">*</span></label>
              <input
                id="reason"
                name="reason"
                className="form-input"
                type="text"
                value={reason}
                onChange={(e) => setReason(e.target.value)}
                placeholder="e.g. Unprofessional behavior"
                required
              />
            </div>

            <div className="form-group">
              <label htmlFor="description" className="form-label">Description<span className="required">*</span></label>
              <textarea
                id="description"
                name="description"
                className="form-input"
                rows="4"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="Provide complete details about the issue"
                required
              />
            </div>

            <div className="form-group">
              <label htmlFor="screenshot" className="form-label">Screenshot Evidence (optional)</label>
              <input
                id="screenshot"
                name="screenshot"
                className="form-input"
                type="file"
                accept="image/*"
                onChange={(e) => setScreenshot(e.target.files?.[0] || null)}
              />
            </div>
          </section>

          <button type="submit" className="btn-submit" disabled={submitting}>
            {submitting ? 'Submitting...' : 'Submit Report'}
          </button>
        </form>
      </div>
    </div>,
    document.body
  );
}
