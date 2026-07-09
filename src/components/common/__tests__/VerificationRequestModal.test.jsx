import { fireEvent, render, screen } from '@testing-library/react';
import '@testing-library/jest-dom/vitest';
import VerificationRequestModal from '../VerificationRequestModal';
import { userProfileAPI } from '../../../services/api';

vi.mock('../../../services/api', () => ({
  userProfileAPI: {
    submitVerificationRequest: vi.fn(),
  },
}));

describe('VerificationRequestModal', () => {
  beforeEach(() => {
    userProfileAPI.submitVerificationRequest.mockResolvedValue({ success: true });
  });

  it('renders the verification request form fields', () => {
    render(<VerificationRequestModal onClose={() => {}} />);

    expect(screen.getByText('Request Verification')).toBeInTheDocument();
    expect(screen.getByText(/required documents/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/full name/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/phone number/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/address/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/describe your services/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/government-issued id/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/certifications/i)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /submit request/i })).toBeInTheDocument();
  });

  it('shows a success message after submission', async () => {
    render(<VerificationRequestModal onClose={() => {}} />);

    fireEvent.change(screen.getByLabelText(/full name/i), {
      target: { value: 'Fix It Services' },
    });
    fireEvent.change(screen.getByLabelText(/phone number/i), {
      target: { value: '09123456789' },
    });
    fireEvent.change(screen.getByLabelText(/address/i), {
      target: { value: '123 Main Street, Toledo City' },
    });
    fireEvent.change(screen.getByLabelText(/describe your services/i), {
      target: { value: 'Plumbing and electrical repairs' },
    });

    const idFile = new File(['id'], 'id.png', { type: 'image/png' });
    const permitFile = new File(['permit'], 'permit.pdf', { type: 'application/pdf' });

    fireEvent.change(screen.getByLabelText(/government-issued id/i), {
      target: { files: [idFile] },
    });
    fireEvent.change(screen.getByLabelText(/certifications/i), {
      target: { files: [permitFile] },
    });

    fireEvent.click(screen.getByRole('button', { name: /submit request/i }));

    expect(await screen.findByText(/verification request submitted successfully/i)).toBeInTheDocument();
  });
});
