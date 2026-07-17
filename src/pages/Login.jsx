import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { authAPI } from '../services/api';
import logo from '../assets/logo.png';
import '../styles/App.css';

const Login = () => {
  const navigate = useNavigate();
  const [showPassword, setShowPassword] = useState(false);
  const [loginAs, setLoginAs] = useState('client');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');

  const [formData, setFormData] = useState({
    email: '',
    password: '',
  });

  const handleInputChange = (e) => {
    const { name, value } = e.target;
    setFormData({ ...formData, [name]: value });
    setError('');
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setIsLoading(true);

    try {
      const response = await authAPI.login({
        email: formData.email,
        password: formData.password,
        loginAs: loginAs,
      });
      
      const redirectPath = sessionStorage.getItem('redirectAfterLogin');
      if (redirectPath) {
        sessionStorage.removeItem('redirectAfterLogin');
        navigate(redirectPath);
        return;
      }
      
      const userType = response.data.user.userType;
      if (userType === 'admin') {
        navigate('/admin/dashboard');
      } else if (userType === 'tradesperson') {
        navigate('/dashboard');
      } else {
        navigate('/feed');
      }
      
    } catch (err) {
      console.error('Login error:', err);
      setError(err.message || 'Login failed. Please check your credentials.');
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
              <p className="subtitle text-muted">login to your account</p>
            </div>

            
            {error && (
              <div className="alert alert-danger py-2 mb-3" role="alert">
                {error}
              </div>
            )}

            <form onSubmit={handleSubmit}>
              
              <div className="mb-3">
                <label className="form-label">Email Address</label>
                <input
                  type="email"
                  name="email"
                  placeholder="internetgirl@gmail.com"
                  value={formData.email}
                  onChange={handleInputChange}
                  className="form-control"
                  required
                />
              </div>

            
              <div className="mb-3">
                <label className="form-label">Password</label>
                <div className="password-input-wrapper">
                  <input
                    type={showPassword ? 'text' : 'password'}
                    name="password"
                    placeholder="password"
                    value={formData.password}
                    onChange={handleInputChange}
                    className="form-control"
                    required
                  />
                  <button
                    type="button"
                    className="password-toggle"
                    onClick={() => setShowPassword(!showPassword)}
                    aria-label="Toggle password visibility"
                  >
                    {showPassword ? (
                      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                        <path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24"></path>
                        <line x1="1" y1="1" x2="23" y2="23"></line>
                      </svg>
                    ) : (
                      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                        <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"></path>
                        <circle cx="12" cy="12" r="3"></circle>
                      </svg>
                    )}
                  </button>
                </div>
              </div>

              <div className="text-end mb-3">
                <Link to="/forgot-password" className="link">Forgot Password?</Link>
              </div>

            
              <div className="mb-4">
                <label className="form-label">Login as</label>
                <div className="radio-pill-group">
                  <div className="radio-pill">
                    <input
                      type="radio"
                      id="login-client"
                      name="loginAs"
                      value="client"
                      checked={loginAs === 'client'}
                      onChange={(e) => setLoginAs(e.target.value)}
                    />
                    <label htmlFor="login-client" className="radio-pill-label">
                      <div>
                        <div className="radio-pill-title">Client</div>
                        <div className="radio-pill-desc">Looking for service provider</div>
                      </div>
                      <div className="radio-pill-indicator"></div>
                    </label>
                  </div>
                  <div className="radio-pill">
                    <input
                      type="radio"
                      id="login-tradesperson"
                      name="loginAs"
                      value="tradesperson"
                      checked={loginAs === 'tradesperson'}
                      onChange={(e) => setLoginAs(e.target.value)}
                    />
                    <label htmlFor="login-tradesperson" className="radio-pill-label">
                      <div>
                        <div className="radio-pill-title">Service Provider</div>
                        <div className="radio-pill-desc">Offering services to clients</div>
                      </div>
                      <div className="radio-pill-indicator"></div>
                    </label>
                  </div>
                  <div className="radio-pill">
                    <input
                      type="radio"
                      id="login-admin"
                      name="loginAs"
                      value="admin"
                      checked={loginAs === 'admin'}
                      onChange={(e) => setLoginAs(e.target.value)}
                    />
                    <label htmlFor="login-admin" className="radio-pill-label">
                      <div>
                        <div className="radio-pill-title">Admin</div>
                        <div className="radio-pill-desc">Manage and oversee services</div>
                      </div>
                      <div className="radio-pill-indicator"></div>
                    </label>
                  </div>
                </div>
              </div>

              {/* Login Button */}
              <button 
                type="submit" 
                className="btn btn-primary w-100 mb-3"
                disabled={isLoading}
              >
                {isLoading ? (
                  <>
                    <span className="spinner-border spinner-border-sm me-2" role="status" aria-hidden="true"></span>
                    Logging in...
                  </>
                ) : (
                  'Login'
                )}
              </button>

              {/* Register Link */}
              <div className="text-center">
                <p className="footer-text mb-0">
                  Don't have an account?{' '}
                  <Link to="/register" className="link">Register here</Link>
                </p>
              </div>
            </form>

            {/* Back to Home */}
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

export default Login;