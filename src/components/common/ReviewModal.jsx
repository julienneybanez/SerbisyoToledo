import { useState } from 'react';
import './ReviewModal.css';

function HalfStarRating({ rating, onRatingChange }) {
  const [hoverRating, setHoverRating] = useState(0);
  const displayRating = hoverRating || rating;

  const handleClick = (starIndex, isHalf) => {
    const value = isHalf ? starIndex - 0.5 : starIndex;
    onRatingChange(value);
  };

  const handleMouseMove = (e, starIndex) => {
    const rect = e.currentTarget.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const isHalf = x < rect.width / 2;
    setHoverRating(isHalf ? starIndex - 0.5 : starIndex);
  };

  return (
    <div className="star-rating-container">
      <div className="stars-row" onMouseLeave={() => setHoverRating(0)}>
        {[1, 2, 3, 4, 5].map((starIndex) => {
          const fillLevel = displayRating >= starIndex 
            ? 'full' 
            : displayRating >= starIndex - 0.5 
              ? 'half' 
              : 'empty';

          return (
            <div
              key={starIndex}
              className={`star-wrapper star-${fillLevel}`}
              onMouseMove={(e) => handleMouseMove(e, starIndex)}
              onClick={(e) => {
                const rect = e.currentTarget.getBoundingClientRect();
                const x = e.clientX - rect.left;
                const isHalf = x < rect.width / 2;
                handleClick(starIndex, isHalf);
              }}
            >
              {/* Empty star background */}
              <svg className="star-svg star-empty-bg" viewBox="0 0 24 24">
                <path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z" />
              </svg>
              {/* Half star fill */}
              {fillLevel === 'half' && (
                <svg className="star-svg star-half-fill" viewBox="0 0 24 24">
                  <defs>
                    <clipPath id={`half-clip-${starIndex}`}>
                      <rect x="0" y="0" width="12" height="24" />
                    </clipPath>
                  </defs>
                  <path 
                    d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z" 
                    clipPath={`url(#half-clip-${starIndex})`}
                  />
                </svg>
              )}
              {/* Full star fill */}
              {fillLevel === 'full' && (
                <svg className="star-svg star-full-fill" viewBox="0 0 24 24">
                  <path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z" />
                </svg>
              )}
            </div>
          );
        })}
      </div>
      <span className="rating-display">
        {displayRating > 0 ? `${displayRating} / 5` : 'Click to rate'}
      </span>
    </div>
  );
}

export default function ReviewModal({ request, onClose, onSubmit, loading }) {
  const [rating, setRating] = useState(0);
  const [comment, setComment] = useState('');

  const handleSubmit = () => {
    if (rating === 0) {
      alert('Please select a star rating');
      return;
    }
    onSubmit({ rating, comment });
  };

  return (
    <div className="review-modal-overlay" onClick={onClose}>
      <div className="review-modal" onClick={(e) => e.stopPropagation()}>
        <button className="review-modal-close" onClick={onClose}>
          <i className="bi bi-x-lg"></i>
        </button>

        <div className="review-modal-header">
          <div className="review-icon-wrapper">
            <i className="bi bi-star-fill"></i>
          </div>
          <h2>Leave a Review</h2>
          <p className="review-subtitle">
            How was your experience with <strong>{request.provider_name}</strong> for "{request.job_title}"?
          </p>
        </div>

        <div className="review-modal-body">
          <div className="review-rating-section">
            <label>Your Rating</label>
            <HalfStarRating rating={rating} onRatingChange={setRating} />
          </div>

          <div className="review-comment-section">
            <label htmlFor="review-comment">Your Review (optional)</label>
            <textarea
              id="review-comment"
              className="review-textarea"
              rows={4}
              value={comment}
              onChange={(e) => setComment(e.target.value)}
              placeholder="Share your experience — what went well, what could be improved..."
              maxLength={1000}
            />
            <span className="char-count">{comment.length}/1000</span>
          </div>
        </div>

        <div className="review-modal-actions">
          <button 
            className="btn-submit-review"
            onClick={handleSubmit}
            disabled={loading || rating === 0}
          >
            {loading ? (
              <><span className="spinner-btn"></span> Submitting...</>
            ) : (
              <><i className="bi bi-send-fill"></i> Submit Review</>
            )}
          </button>
          <button className="btn-cancel-review" onClick={onClose}>
            Cancel
          </button>
        </div>
      </div>
    </div>
  );
}
