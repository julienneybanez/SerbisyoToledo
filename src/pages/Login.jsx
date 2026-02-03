import { useState } from 'react';
import '../styles/App.css';

const Login = () => {
  const [showPassword, setShowPassword] = useState(false);
  const [loginAs, setLoginAs] = useState('client');

  const [formData, setFormData] = useState({
    email: '',
    password: '',
  });

  const handleInputChange = (e) => {
    const { name, value } = e.target;
    setFormData({ ...formData, [name]: value });
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    console.log('Login submitted:', { ...formData, loginAs });
    // Add your login logic here
  };

  return (
    <div className="gradient-container">
      <div className="container d-flex justify-content-center align-items-center min-vh-100 py-5">
        <div className="card content-card shadow-lg">
          <div className="card-body p-4 p-md-5">
            {/* Logo and Header */}
            <div className="text-center mb-4">
              <div className="logo-circle mx-auto mb-3">
                <svg 
                  width="32" 
                  height="32" 
                  viewBox="0 0 24 24" 
                  fill="none" 
                  stroke="white" 
                  strokeWidth="2" 
                  strokeLinecap="round" 
                  strokeLinejoin="round"
                >
                  <path d="M14.7 6.3a1 1 0 0 0 0 1.4l1.6 1.6a1 1 0 0 0 1.4 0l3.77-3.77a6 6 0 0 1-7.94 7.94l-6.91 6.91a2.12 2.12 0 0 1-3-3l6.91-6.91a6 6 0 0 1 7.94-7.94l-3.76 3.76z" />
                </svg>
              </div>
              <h1 className="app-title mb-2">
                Serbisyo<span className="title-green">Toledo</span>
              </h1>
              <p className="subtitle text-muted">login to your account</p>
            </div>

            <form onSubmit={handleSubmit}>
              {/* Email Address */}
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

              {/* Password */}
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

              {/* Login As Selection */}
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
                        <div className="radio-pill-title">Tradesperson</div>
                        <div className="radio-pill-desc">Offering services to client</div>
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
                        <div className="radio-pill-title">Barangay Admin</div>
                        <div className="radio-pill-desc">Manage and oversee services</div>
                      </div>
                      <div className="radio-pill-indicator"></div>
                    </label>
                  </div>
                </div>
              </div>

              {/* Login Button */}
              <button type="submit" className="btn btn-primary w-100 mb-3">
                Login
              </button>

              {/* Register Link */}
              <div className="text-center">
                <p className="footer-text mb-0">
                  Don't have an account?{' '}
                  <a href="/register" className="link">Register here</a>
                </p>
              </div>
            </form>

            {/* Back to Home */}
            <div className="text-center mt-4">
              <a href="/" className="back-link text-decoration-none">
                ← Back to home
              </a>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Login;