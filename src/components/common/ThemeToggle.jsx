import { useTheme } from '../../context/ThemeContext';
import './ThemeToggle.css';

function ThemeToggle({ compact = false, className = '' }) {
  const { theme, isDark, toggleTheme } = useTheme();
  const nextTheme = isDark ? 'light' : 'dark';

  return (
    <button
      type="button"
      className={`theme-toggle ${compact ? 'theme-toggle-compact' : ''} ${className}`.trim()}
      onClick={toggleTheme}
      aria-label={`Switch to ${nextTheme} theme`}
      title={`Current theme: ${theme}`}
    >
      <span className="theme-toggle-icon" aria-hidden="true">
        <i className={`bi ${isDark ? 'bi-moon-stars-fill' : 'bi-brightness-high-fill'}`}></i>
      </span>
      <span className="theme-toggle-label">{isDark ? 'Dark' : 'Light'}</span>
    </button>
  );
}

export default ThemeToggle;
