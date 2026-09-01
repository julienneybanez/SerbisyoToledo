function initialsFromName(name = '') {
  return String(name)
    .trim()
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part.charAt(0).toUpperCase())
    .join('');
}

export default function AppAvatar({
  src = '',
  alt = '',
  name = '',
  size = 'md',
  className = '',
  ...props
}) {
  const initials = initialsFromName(name) || '?';

  return (
    <span
      className={['st-avatar', `st-avatar--${size}`, className].filter(Boolean).join(' ')}
      {...props}
    >
      {src ? (
        <img src={src} alt={alt} className="st-avatar-image non-draggable-image" draggable="false" />
      ) : (
        <span className="st-avatar-fallback" aria-hidden={Boolean(alt)}>
          {initials}
        </span>
      )}
    </span>
  );
}
