import { forwardRef } from 'react';

const AppSelect = forwardRef(function AppSelect({ className = '', children, ...props }, ref) {
  return (
    <select
      ref={ref}
      className={['st-form-control', 'st-select', 'mock-select', className].filter(Boolean).join(' ')}
      {...props}
    >
      {children}
    </select>
  );
});

export default AppSelect;
