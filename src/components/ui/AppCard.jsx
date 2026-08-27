export default function AppCard({
  as: Component = 'div',
  flat = false,
  interactive = false,
  className = '',
  children,
  ...props
}) {
  const classes = [
    'st-card',
    flat ? 'st-card--flat' : '',
    interactive ? 'st-card--interactive' : '',
    className,
  ].filter(Boolean).join(' ');

  return (
    <Component className={classes} {...props}>
      {children}
    </Component>
  );
}
