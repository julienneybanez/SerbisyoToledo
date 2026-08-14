import './RoleSelectionCards.css';

const ROLE_OPTIONS = [
  {
    value: 'client',
    title: 'I need a service',
    description: 'Find and book local service providers.',
    iconClass: 'bi bi-search-heart',
  },
  {
    value: 'tradesperson',
    title: 'I provide services',
    description: 'Offer your skills to Toledo residents.',
    iconClass: 'bi bi-tools',
  },
];

export default function RoleSelectionCards({ value, onChange }) {
  return (
    <fieldset className="role-selection-fieldset" aria-label="Choose account role">
      <legend className="role-selection-title">How will you use SerbisyoToledo?</legend>
      <div className="role-selection-grid">
        {ROLE_OPTIONS.map((option) => {
          const selected = value === option.value;
          return (
            <label key={option.value} className={`role-selection-card ${selected ? 'selected' : ''}`}>
              <input
                type="radio"
                name="userType"
                value={option.value}
                checked={selected}
                onChange={(event) => onChange(event.target.value)}
              />
              <span className="role-selection-card-content">
                <span className="role-selection-icon" aria-hidden="true">
                  <i className={option.iconClass}></i>
                </span>
                <span className="role-selection-copy">
                  <span className="role-selection-card-title">{option.title}</span>
                  <span className="role-selection-card-description">{option.description}</span>
                </span>
                <span className="role-selection-check" aria-hidden="true">
                  <i className="bi bi-check2"></i>
                </span>
              </span>
            </label>
          );
        })}
      </div>
    </fieldset>
  );
}
