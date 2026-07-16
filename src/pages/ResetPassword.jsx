import { useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { authAPI } from '../services/api';
import logo from '../assets/logo.png';
import '../styles/App.css';

const ResetPassword = () => {
  const { token } = useParams();
  const navigate = useNavigate();
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [formData, setFormData] = useState({
    password: '',
    confirmPassword: '',
  });

  const handleInputChange = (e) => {
    const { name, value } = e.target;
    setFormData((prev) => ({ ...prev, [name]: value }));
    setError('');
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setSuccess('');

    if (formData.password !== formData.confirmPassword) {
      setError('Passwords do not match.');
      return;
    }

    setIsLoading(true);

    try {
      const response = await authAPI.resetPassword(token, {
        password: formData.password,
        confirmPassword: formData.confirmPassword,
      });

      setSuccess(response.message || 'Password reset successful. Redirecting to login...');
      setFormData({ password: '', confirmPassword: '' });

      setTimeout(() => {
        navigate('/login');
      }, 1800);
    } catch (err) {
      setError(err.message || 'Failed to reset password. Please try again.');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="gradient-container">
      <div className="container d-flex justify-content-center align-items-center min-vh-100 py-5">
        <div className="card content-card shadow-lg">
          <div className="card-body p-4 p-md-5">
            <div className="text-center mb-4">
              <img src={logo} alt="SerbisyoToledo" className="logo-img" />
              <h1 className="app-title mb-2">
                Serbisyo<span className="title-green">Toledo</span>
              </h1>
              <p className="subtitle text-muted">reset your password</p>
            </div>

            {error && (
              <div className="alert alert-danger py-2 mb-3" role="alert">
                {error}
              </div>
            )}

            {success && (
              <div className="alert alert-success py-2 mb-3" role="alert">
                {success}
              </div>
            )}

            <form onSubmit={handleSubmit}>
              <div className="mb-3">
                <label className="form-label">New Password</label>
                <div className="password-input-wrapper">
                  <input
                    type={showPassword ? 'text' : 'password'}
                    name="password"
                    value={formData.password}
                    onChange={handleInputChange}
                    className="form-control"
                    placeholder="Enter new password"
                    minLength={6}
                    required
                  />
                  <button
                    type="button"
                    className="password-toggle"
                    onClick={() => setShowPassword(!showPassword)}
                    aria-label="Toggle password visibility"
                  >
                    {showPassword ? 'Hide' : 'Show'}
                  </button>
                </div>
              </div>

              <div className="mb-4">
                <label className="form-label">Confirm New Password</label>
                <div className="password-input-wrapper">
                  <input
                    type={showConfirmPassword ? 'text' : 'password'}
                    name="confirmPassword"
                    value={formData.confirmPassword}
                    onChange={handleInputChange}
                    className="form-control"
                    placeholder="Confirm new password"
                    minLength={6}
                    required
                  />
                  <button
                    type="button"
                    className="password-toggle"
                    onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                    aria-label="Toggle confirm password visibility"
                  >
                    {showConfirmPassword ? 'Hide' : 'Show'}
                  </button>
                </div>
              </div>

              <button
                type="submit"
                className="btn btn-primary w-100 mb-3"
                disabled={isLoading}
              >
                {isLoading ? (
                  <>
                    <span className="spinner-border spinner-border-sm me-2" role="status" aria-hidden="true"></span>
                    Updating Password...
                  </>
                ) : (
                  'Reset Password'
                )}
              </button>
            </form>

            <div className="text-center">
              <p className="footer-text mb-0">
                Back to{' '}
                <Link to="/login" className="link">Login</Link>
              </p>
            </div>

            <div className="text-center mt-4">
              <Link to="/" className="back-link text-decoration-none">
                ← Back to home
              </Link>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default ResetPassword;
