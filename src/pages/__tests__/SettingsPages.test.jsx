import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import '@testing-library/jest-dom/vitest';
import ClientSettings from '../ClientSettings';
import ServiceProviderSettings from '../ServiceProviderSettings';
import AdminSettings from '../admin/AdminSettings';
import { getUser, serviceProfileAPI, userProfileAPI, verificationAPI } from '../../services/api';
import { LanguageProvider } from '../../context/LanguageContext';

const mockNavigate = vi.fn();

vi.mock('react-router-dom', () => ({
  useNavigate: () => mockNavigate,
  useLocation: () => ({ pathname: '/provider-settings', search: '' }),
  useSearchParams: () => [new URLSearchParams('')],
}));

vi.mock('../../components/common/ThemeToggle', () => ({
  default: () => <div data-testid="theme-toggle">theme</div>,
}));

vi.mock('../../services/api', () => ({
  API_BASE_URL: 'http://localhost:5000/api',
  getUser: vi.fn(),
  verificationAPI: {
    resendVerification: vi.fn(),
  },
  userProfileAPI: {
    getProfile: vi.fn(),
    updateProfile: vi.fn(),
  },
  serviceProfileAPI: {
    getMyAvailability: vi.fn(),
    saveMyAvailability: vi.fn(),
    getMyLanguages: vi.fn(),
    updateMyLanguages: vi.fn(),
    getMyCredentials: vi.fn(),
    createCredential: vi.fn(),
    submitCredentialForReview: vi.fn(),
    addAvailabilityException: vi.fn(),
    deleteAvailabilityException: vi.fn(),
  },
}));

describe('Settings pages', () => {
  const renderWithProviders = (ui) => render(
    <LanguageProvider>{ui}</LanguageProvider>,
  );

  beforeEach(() => {
    vi.clearAllMocks();
    mockNavigate.mockReset();

    globalThis.fetch = vi.fn(async () => ({
      ok: true,
      json: async () => ({
        status: 'ok',
        database: 'connected',
        timestamp: '2026-07-30T12:00:00.000Z',
      }),
    }));
  });

  it('client settings saves useful profile fields and can resend verification', async () => {
    getUser.mockReturnValue({
      userType: 'client',
      fullName: 'Client User',
      email: 'client@example.com',
      emailVerified: false,
    });

    userProfileAPI.getProfile.mockResolvedValue({
      success: true,
      data: {
        fullName: 'Client User',
        email: 'client@example.com',
        phone: '09123456789',
        address: 'Old Address',
        createdAt: '2026-01-01T00:00:00.000Z',
      },
    });

    userProfileAPI.updateProfile.mockResolvedValue({
      success: true,
      data: {
        fullName: 'Client Updated',
        phone: '09998887777',
        address: 'New Address',
      },
    });

    verificationAPI.resendVerification.mockResolvedValue({
      success: true,
    });

    renderWithProviders(<ClientSettings />);

    expect(await screen.findByText('Client Settings')).toBeInTheDocument();
    expect(screen.queryByText('Bio')).not.toBeInTheDocument();

    fireEvent.change(screen.getByDisplayValue('Client User'), {
      target: { value: 'Client Updated' },
    });

    fireEvent.click(screen.getByRole('button', { name: 'Save Changes' }));

    await waitFor(() => {
      expect(userProfileAPI.updateProfile).toHaveBeenCalledTimes(1);
    });

    expect(await screen.findByText('Profile settings saved successfully.')).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: 'Security' }));
    fireEvent.click(screen.getByRole('button', { name: 'Resend Verification Email' }));

    await waitFor(() => {
      expect(verificationAPI.resendVerification).toHaveBeenCalledWith({
        email: 'client@example.com',
      });
    });
  });

  it('provider settings only exposes persisted account, schedule, language, and credential controls', async () => {
    getUser.mockReturnValue({
      userType: 'tradesperson',
      fullName: 'Provider User',
      email: 'provider@example.com',
      emailVerified: false,
    });

    userProfileAPI.getProfile.mockResolvedValue({
      success: true,
      data: {
        fullName: 'Provider User',
        email: 'provider@example.com',
        phone: '09120000000',
        emailVerified: false,
      },
    });

    userProfileAPI.updateProfile.mockResolvedValue({
      success: true,
      data: {
        fullName: 'Provider User Updated',
        phone: '09120000000',
      },
    });

    serviceProfileAPI.getMyAvailability.mockResolvedValue({
      success: true,
      data: {
        settings: {
          allowSameDayBooking: false,
          minAdvanceNoticeMinutes: 720,
          maxAdvanceBookingDays: 60,
        },
        weeklyBlocks: [],
        exceptions: [],
        specificAvailability: [],
      },
    });

    serviceProfileAPI.getMyLanguages.mockResolvedValue({
      success: true,
      data: { languages: ['en'] },
    });

    serviceProfileAPI.getMyCredentials.mockResolvedValue({
      success: true,
      data: { credentials: [] },
    });

    serviceProfileAPI.saveMyAvailability.mockResolvedValue({
      success: true,
      data: { mode: 'specific', specificAvailabilityCount: 0 },
    });

    verificationAPI.resendVerification.mockResolvedValue({
      success: true,
    });

    renderWithProviders(<ServiceProviderSettings />);

    expect(await screen.findByText('Service Provider Settings')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Business' })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Notifications' })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Privacy' })).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: 'Schedule' }));
    expect(await screen.findByText('Schedule & Booking Settings')).toBeInTheDocument();
    expect(screen.getByText('Available Dates & Time Slots')).toBeInTheDocument();
    expect(screen.queryByText('Date Exceptions')).not.toBeInTheDocument();
    expect(screen.queryByText('Booked')).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: 'Save Availability' }));
    await waitFor(() => {
      expect(serviceProfileAPI.saveMyAvailability).toHaveBeenCalledWith(expect.objectContaining({
        specificAvailability: [],
      }));
    });

    fireEvent.click(screen.getByRole('button', { name: 'Languages & Credentials' }));
    expect(await screen.findByText('Languages Spoken')).toBeInTheDocument();
    expect(screen.getByText('Credentials and Certificates')).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: 'Account' }));
    expect(screen.getByText('Not Verified')).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: 'Resend Verification Email' }));
    await waitFor(() => {
      expect(verificationAPI.resendVerification).toHaveBeenCalledWith({
        email: 'provider@example.com',
      });
    });

    fireEvent.click(screen.getByRole('button', { name: 'Open Password Reset' }));
    expect(mockNavigate).toHaveBeenCalledWith('/forgot-password');

    fireEvent.change(screen.getByDisplayValue('Provider User'), {
      target: { value: 'Provider User Updated' },
    });
    fireEvent.click(screen.getByRole('button', { name: 'Save Changes' }));

    await waitFor(() => {
      expect(userProfileAPI.updateProfile).toHaveBeenCalledTimes(1);
    });
  });

  it('admin system status only checks live health and refreshes it', async () => {
    renderWithProviders(<AdminSettings />);

    expect(await screen.findByText('System Status')).toBeInTheDocument();

    await waitFor(() => {
      expect(globalThis.fetch).toHaveBeenCalledTimes(1);
    });

    expect(screen.getByText('connected')).toBeInTheDocument();
    expect(screen.queryByText('Moderation')).not.toBeInTheDocument();
    expect(screen.queryByText('Export Snapshot JSON')).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: 'Refresh Status' }));

    await waitFor(() => {
      expect(globalThis.fetch).toHaveBeenCalledTimes(2);
    });
  });
});
