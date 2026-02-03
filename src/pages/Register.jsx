import { useState } from 'react';
import '../styles/App.css';

const Register = () => {
  const [userType, setUserType] = useState('client');
  const [showPassword, setShowPassword] = useState(false);
  const [skills, setSkills] = useState([]);
  const [currentSkill, setCurrentSkill] = useState('');

  const [formData, setFormData] = useState({
    fullName: '',
    email: '',
    password: '',
    preferredServices: '',
    profession: '',
  });

  const handleInputChange = (e) => {
    const { name, value } = e.target;
    setFormData({ ...formData, [name]: value });
  };

  const handleAddSkill = () => {
    if (currentSkill.trim() && !skills.includes(currentSkill.trim())) {
      setSkills([...skills, currentSkill.trim()]);
      setCurrentSkill('');
    }
  };

  const handleRemoveSkill = (skillToRemove) => {
    setSkills(skills.filter(skill => skill !== skillToRemove));
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    console.log('Form submitted:', { ...formData, userType, skills });
    // Add your registration logic here
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
              <p className="subtitle text-muted">create your account</p>
            </div>

            <form onSubmit={handleSubmit}>
              {/* User Type Selection */}
              <div className="mb-3">
                <label className="form-label">I want to</label>
                <div className="radio-pill-group">
                  <div className="radio-pill">
                    <input
                      type="radio"
                      id="client"
                      name="userType"
                      value="client"
                      checked={userType === 'client'}
                      onChange={(e) => setUserType(e.target.value)}
                    />
                    <label htmlFor="client" className="radio-pill-label">
                      <div>
                        <div className="radio-pill-title">find service providers</div>
                        <div className="radio-pill-desc">Register as a client</div>
                      </div>
                      <div className="radio-pill-indicator"></div>
                    </label>
                  </div>
                  <div className="radio-pill">
                    <input
                      type="radio"
                      id="tradesperson"
                      name="userType"
                      value="tradesperson"
                      checked={userType === 'tradesperson'}
                      onChange={(e) => setUserType(e.target.value)}
                    />
                    <label htmlFor="tradesperson" className="radio-pill-label">
                      <div>
                        <div className="radio-pill-title">offer my services</div>
                        <div className="radio-pill-desc">Register as a tradesperson</div>
                      </div>
                      <div className="radio-pill-indicator"></div>
                    </label>
                  </div>
                </div>
              </div>

              {/* Full Name and Email */}
              <div className="row mb-3">
                <div className="col-md-6 mb-3 mb-md-0">
                  <label className="form-label">Full name</label>
                  <input
                    type="text"
                    name="fullName"
                    placeholder="Sophia Laforteza"
                    value={formData.fullName}
                    onChange={handleInputChange}
                    className="form-control"
                    required
                  />
                </div>
                <div className="col-md-6">
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
              </div>

              {/* Password */}
              <div className="mb-3">
                <label className="form-label">Password</label>
                <div className="password-input-wrapper">
                  <input
                    type={showPassword ? 'text' : 'password'}
                    name="password"
                    placeholder="Create a strong password"
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

              {/* Conditional Fields based on User Type */}
              {userType === 'client' ? (
                /* Preferred Services for Client */
                <div className="mb-4">
                  <label className="form-label">Preferred services</label>
                  <select
                    name="preferredServices"
                    value={formData.preferredServices}
                    onChange={handleInputChange}
                    className="form-select"
                  >
                    <option value="">Optional</option>
                    <option value="plumbing">Plumbing</option>
                    <option value="electrical">Electrical</option>
                    <option value="carpentry">Carpentry</option>
                    <option value="painting">Painting</option>
                    <option value="cleaning">Cleaning</option>
                    <option value="gardening">Gardening</option>
                  </select>
                </div>
              ) : (
                /* Professional Details for Tradesperson */
                <div className="professional-details mb-4">
                  <h3>Professional Details</h3>
                  
                  <div className="mb-3">
                    <label className="form-label">Profession</label>
                    <input
                      type="text"
                      name="profession"
                      placeholder="e.g. Electrician, Plumber, Carpenter"
                      value={formData.profession}
                      onChange={handleInputChange}
                      className="form-control"
                    />
                  </div>

                  <div className="mb-3">
                    <label className="form-label">Skills & Specializations</label>
                    <div className="skill-input-group">
                      <input
                        type="text"
                        placeholder="Add a skill (e.g. wiring, installation)"
                        value={currentSkill}
                        onChange={(e) => setCurrentSkill(e.target.value)}
                        onKeyPress={(e) => {
                          if (e.key === 'Enter') {
                            e.preventDefault();
                            handleAddSkill();
                          }
                        }}
                        className="form-control"
                      />
                      <button
                        type="button"
                        className="add-skill-btn"
                        onClick={handleAddSkill}
                      >
                        +
                      </button>
                    </div>
                    
                    {skills.length > 0 && (
                      <div className="skill-tags">
                        {skills.map((skill, index) => (
                          <div key={index} className="skill-tag">
                            {skill}
                            <button
                              type="button"
                              className="skill-tag-remove"
                              onClick={() => handleRemoveSkill(skill)}
                            >
                              ×
                            </button>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              )}

              {/* Submit Button */}
              <button type="submit" className="btn btn-primary w-100 mb-3">
                Create Account
              </button>

              {/* Login Link */}
              <div className="text-center">
                <p className="footer-text mb-0">
                  Already have an account?{' '}
                  <a href="/login" className="link">Login here</a>
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

export default Register;