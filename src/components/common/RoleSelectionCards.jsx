import './RoleSelectionCards.css';

const ROLE_OPTIONS = [
  {
    value: 'client',
    title: "I'm Looking for a Service",
    description: 'Create a client account to search for providers and submit booking requests.',
    iconClass: 'bi bi-search-heart',
  },
  {
    value: 'tradesperson',
    title: 'I Offer Services',
    description: 'Create a provider account to promote services and receive booking requests.',
    iconClass: 'bi bi-tools',
  },
];

export default function RoleSelectionCards({ value, onChange }) {
  return (
    <fieldset className="role-selection-fieldset mb-4" aria-label="Choose account role">
      <legend className="role-selection-title">How would you like to use SerbisyoToledo?</legend>
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
                onChange={(e) => onChange(e.target.value)}
              />
              <div className="role-selection-card-content">
                <div className="role-selection-icon" aria-hidden="true">
                  <i className={option.iconClass}></i>
                </div>
                <div>
                  <h3 className="role-selection-card-title">{option.title}</h3>
                  <p className="role-selection-card-description mb-0">{option.description}</p>
                </div>
              </div>
            </label>
          );
        })}
      </div>
    </fieldset>
  );
}
