export default function SettingsFlash({ type = 'info', message }) {
  if (!message) {
    return null;
  }

  return <div className={`settings-flash ${type}`}>{message}</div>;
}