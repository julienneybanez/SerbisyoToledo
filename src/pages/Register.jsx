import { useEffect, useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { authAPI } from '../services/api';
import RoleSelectionCards from '../components/common/RoleSelectionCards';
import { useLanguage } from '../context/LanguageContext';

const LANGUAGE_OPTIONS = [
  { value: 'ceb', label: 'Cebuano' },
  { value: 'en', label: 'English' },
  { value: 'fil', label: 'Filipino' },
];

const Register = () => {
  const navigate = useNavigate();
  const { t } = useLanguage();
  const [searchParams] = useSearchParams();
  const [userType, setUserType] = useState('client');
  const [showPassword, setShowPassword] = useState(false);
  const [skills, setSkills] = useState([]);
  const [languages, setLanguages] = useState([]);
  const [currentSkill, setCurrentSkill] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  const [formData, setFormData] = useState({
    fullName: '',
    email: '',
    password: '',
    profession: '',
  });

  useEffect(() => {
    const requestedRole = (searchParams.get('role') || '').toLowerCase();

    if (requestedRole === 'client') {
      setUserType('client');
      return;
    }

    if (requestedRole === 'provider') {
      setUserType('tradesperson');
    }
  }, [searchParams]);

  const handleInputChange = (event) => {
    const { name, value } = event.target;
    setFormData({ ...formData, [name]: value });
    setError('');
  };

  const handleAddSkill = () => {
    if (currentSkill.trim() && !skills.includes(currentSkill.trim())) {
      setSkills([...skills, currentSkill.trim()]);
      setCurrentSkill('');
    }
  };

  const handleRemoveSkill = (skillToRemove) => {
    setSkills(skills.filter((skill) => skill !== skillToRemove));
  };

  const handleToggleLanguage = (languageCode) => {
    setLanguages((previous) => {
      if (previous.includes(languageCode)) {
        return previous.filter((code) => code !== languageCode);
      }

      return [...previous, languageCode];
    });
  };

  const handleSubmit = async (event) => {
    event.preventDefault();
    setError('');
    setSuccess('');
    setIsLoading(true);

    if (!['client', 'tradesperson'].includes(userType)) {
      setError(t('selectValidAccountType'));
      setIsLoading(false);
      return;
    }

    try {
      const registrationData = {
        fullName: formData.fullName,
        email: formData.email,
        password: formData.password,
        userType,
      };

      if (userType === 'tradesperson') {
        if (formData.profession) {
          registrationData.profession = formData.profession;
        }
        if (skills.length > 0) {
          registrationData.skills = skills;
        }
        if (languages.length > 0) {
          registrationData.languages = languages;
        }
      }

      const response = await authAPI.register(registrationData);

      setSuccess(t('registrationSuccessRedirecting'));

      setTimeout(() => {
        if (response?.data?.token) {
          if (userType === 'tradesperson') {
            navigate('/dashboard');
          } else {
            navigate('/feed');
          }
        } else {
          navigate('/login');
        }
      }, 1500);
    } catch (err) {
      console.error('Registration error:', err);
      setError(err.message || t('registrationFailedTryAgain'));
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <section className="auth-page auth-page-register" aria-labelledby="register-title">
      <div className="auth-card auth-register-card">
        <div className="auth-heading auth-heading-centered">
          <p className="auth-eyebrow">SerbisyoToledo</p>
          <h1 id="register-title">{t('createYourAccount')}</h1>
          <p>{t('footerTagline')}</p>
        </div>

        {error && (
          <div className="alert alert-danger auth-alert" role="alert">
            {error}
          </div>
        )}

        {success && (
          <div className="alert alert-success auth-alert" role="status">
            {success}
          </div>
        )}

        <form onSubmit={handleSubmit} className="auth-form">
          <RoleSelectionCards value={userType} onChange={setUserType} />

          <div className="auth-two-column">
            <div className="auth-field">
              <label htmlFor="register-full-name" className="form-label">{t('fullName')}</label>
              <input
                id="register-full-name"
                type="text"
                name="fullName"
                placeholder={t('fullNamePlaceholder')}
                value={formData.fullName}
                onChange={handleInputChange}
                className="form-control"
                autoComplete="name"
                required
              />
            </div>
            <div className="auth-field">
              <label htmlFor="register-email" className="form-label">{t('emailAddress')}</label>
              <input
                id="register-email"
                type="email"
                name="email"
                placeholder={t('loginEmailPlaceholder')}
                value={formData.email}
                onChange={handleInputChange}
                className="form-control"
                autoComplete="email"
                required
              />
            </div>
          </div>

          <div className="auth-field">
            <label htmlFor="register-password" className="form-label">{t('password')}</label>
            <div className="password-input-wrapper">
              <input
                id="register-password"
                type={showPassword ? 'text' : 'password'}
                name="password"
                placeholder={t('createStrongPassword')}
                value={formData.password}
                onChange={handleInputChange}
                className="form-control"
                autoComplete="new-password"
                required
              />
              <button
                type="button"
                className="password-toggle"
                onClick={() => setShowPassword((visible) => !visible)}
                aria-label={t('togglePasswordVisibility')}
              >
                <i className={`bi ${showPassword ? 'bi-eye-slash' : 'bi-eye'}`} aria-hidden="true"></i>
              </button>
            </div>
          </div>

          {userType === 'tradesperson' && (
            <section className="professional-details" aria-labelledby="professional-details-title">
              <div className="professional-details-heading">
                <div>
                  <p className="auth-section-kicker">{t('serviceProvider')}</p>
                  <h2 id="professional-details-title">{t('professionalDetails')}</h2>
                </div>
                <i className="bi bi-tools" aria-hidden="true"></i>
              </div>

              <div className="auth-field">
                <label htmlFor="register-profession" className="form-label">{t('profession')}</label>
                <input
                  id="register-profession"
                  type="text"
                  name="profession"
                  placeholder={t('professionPlaceholder')}
                  value={formData.profession}
                  onChange={handleInputChange}
                  className="form-control"
                />
              </div>

              <div className="auth-field">
                <label htmlFor="register-skill" className="form-label">{t('skillsAndSpecializations')}</label>
                <div className="skill-input-group">
                  <input
                    id="register-skill"
                    type="text"
                    placeholder={t('addSkillPlaceholder')}
                    value={currentSkill}
                    onChange={(event) => setCurrentSkill(event.target.value)}
                    onKeyDown={(event) => {
                      if (event.key === 'Enter') {
                        event.preventDefault();
                        handleAddSkill();
                      }
                    }}
                    className="form-control"
                  />
                  <button
                    type="button"
                    className="add-skill-btn"
                    onClick={handleAddSkill}
                    aria-label="Add skill"
                  >
                    <i className="bi bi-plus-lg" aria-hidden="true"></i>
                  </button>
                </div>

                {skills.length > 0 && (
                  <div className="skill-tags" aria-label="Selected skills">
                    {skills.map((skill) => (
                      <span key={skill} className="skill-tag">
                        {skill}
                        <button
                          type="button"
                          className="skill-tag-remove"
                          onClick={() => handleRemoveSkill(skill)}
                          aria-label={`Remove ${skill}`}
                        >
                          <i className="bi bi-x" aria-hidden="true"></i>
                        </button>
                      </span>
                    ))}
                  </div>
                )}
              </div>

              <div className="auth-field">
                <span className="form-label d-block">{t('languagesSpoken')}</span>
                <div className="auth-language-options">
                  {LANGUAGE_OPTIONS.map((option) => (
                    <label key={option.value} className="auth-language-option">
                      <input
                        type="checkbox"
                        checked={languages.includes(option.value)}
                        onChange={() => handleToggleLanguage(option.value)}
                      />
                      <span>{option.label}</span>
                    </label>
                  ))}
                </div>
                <small className="auth-help-text">{t('languagesSpokenHelp')}</small>
              </div>
            </section>
          )}

          <button
            type="submit"
            className="btn btn-primary auth-submit"
            disabled={isLoading}
          >
            {isLoading ? (
              <>
                <span className="spinner-border spinner-border-sm" role="status" aria-hidden="true"></span>
                {t('creatingAccount')}
              </>
            ) : (
              t('createAccount')
            )}
          </button>

          <p className="auth-switch-copy">
            {t('alreadyHaveAccount')}{' '}
            <Link to="/login">{t('loginHere')}</Link>
          </p>
        </form>
      </div>
    </section>
  );
};

export default Register;
