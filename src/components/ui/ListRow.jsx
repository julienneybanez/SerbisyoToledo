export default function ListRow({ as: Component = 'div', className = '', children, ...props }) {
  return (
    <Component className={['mock-listrow', className].filter(Boolean).join(' ')} {...props}>
      {children}
    </Component>
  );
}
