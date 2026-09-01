import { forwardRef } from 'react';

const AppInput = forwardRef(function AppInput({ className = '', ...props }, ref) {
  return (
    <input
      ref={ref}
      className={['st-form-control', 'st-input', 'mock-input', className].filter(Boolean).join(' ')}
      {...props}
    />
  );
});

export default AppInput;
