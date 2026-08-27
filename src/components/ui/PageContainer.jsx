export default function PageContainer({
  as: Component = 'div',
  className = '',
  children,
  ...props
}) {
  return (
    <Component className={['st-page-container', className].filter(Boolean).join(' ')} {...props}>
      {children}
    </Component>
  );
}
