export default function AppButton({
  as: Component = 'button',
  variant = 'primary',
  size = 'md',
  className = '',
  icon = null,
  children,
  ...props
}) {
  const componentProps = { ...props };

  if (Component === 'button' && !componentProps.type) {
    componentProps.type = 'button';
  }

  return (
    <Component
      className={['st-button', `st-button--${variant}`, `st-button--${size}`, className].filter(Boolean).join(' ')}
      {...componentProps}
    >
      {icon}
      {children}
    </Component>
  );
}
