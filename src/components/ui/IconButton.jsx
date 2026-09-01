export default function IconButton({ className = '', children, ...props }) {
  return (
    <button
      type="button"
      className={['mock-iconbtn', className].filter(Boolean).join(' ')}
      {...props}
    >
      {children}
    </button>
  );
}
