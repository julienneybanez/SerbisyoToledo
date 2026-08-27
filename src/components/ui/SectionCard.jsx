import AppCard from './AppCard';

export default function SectionCard({ className = '', children, ...props }) {
  return (
    <AppCard className={['st-section-card', className].filter(Boolean).join(' ')} {...props}>
      {children}
    </AppCard>
  );
}
