import { forwardRef } from 'react';

const AppTextarea = forwardRef(function AppTextarea({ className = '', ...props }, ref) {
  return (
    <textarea
      ref={ref}
      className={['st-form-control', 'st-textarea', className].filter(Boolean).join(' ')}
      {...props}
    />
  );
});

export default AppTextarea;
