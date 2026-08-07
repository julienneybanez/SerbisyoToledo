import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import '@testing-library/jest-dom/vitest';
import ClientSettings from '../ClientSettings';
import ServiceProviderSettings from '../ServiceProviderSettings';
import AdminSettings from '../admin/AdminSettings';
import { adminAPI, authAPI, getUser, serviceProfileAPI, userProfileAPI } from '../../services/api';
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

vi.mock('../../components/common/VerificationRequestModal', () => ({
  default: ({ onClose }) => (
    <div data-testid="verification-modal">
      <button onClick={onClose}>Close Verification Modal</button>
      Verification Request Modal
    </div>
  ),
}));

vi.mock('../../services/api', () => ({
  API_BASE_URL: 'http://localhost:5000/api',
  getUser: vi.fn(),
  authAPI: {
    resendVerification: vi.fn(),
  },
  userProfileAPI: {
    getProfile: vi.fn(),
    updateProfile: vi.fn(),
  },
  serviceProfileAPI: {
    getMyProfile: vi.fn(),
    getMyPortfolio: vi.fn(),
    createProfile: vi.fn(),
    togglePublish: vi.fn(),
    updatePortfolioDetails: vi.fn(),
    getMyAvailability: vi.fn(),
    saveMyAvailability: vi.fn(),
    getMyLanguages: vi.fn(),
    updateMyLanguages: vi.fn(),
    getMyCredentials: vi.fn(),
  },
  adminAPI: {
    getDashboardStats: vi.fn(),
    getAllUsers: vi.fn(),
    getVerificationRequests: vi.fn(),
    getReports: vi.fn(),
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
      json: async () => ({ status: 'ok', timestamp: '2026-07-30T12:00:00.000Z' }),
    }));
  });

  it('client settings saves profile changes and shows resend verification as disabled', async () => {
    getUser.mockReturnValue({
      userType: 'client',
      fullName: 'Client User',
      email: 'client@example.com',
      isVerified: false,
    });

    userProfileAPI.getProfile.mockResolvedValue({
      success: true,
      data: {
        fullName: 'Client User',
        email: 'client@example.com',
        phone: '09123456789',
        address: 'Old Address',
        bio: 'Old bio',
        createdAt: '2026-01-01T00:00:00.000Z',
      },
    });

    userProfileAPI.updateProfile.mockResolvedValue({
      success: true,
      data: {
        fullName: 'Client Updated',
        phone: '09998887777',
        address: 'New Address',
        bio: 'New bio',
      },
    });

    renderWithProviders(<ClientSettings />);

    expect(await screen.findByText('Client Settings')).toBeInTheDocument();

    fireEvent.change(screen.getByDisplayValue('Client User'), {
      target: { value: 'Client Updated' },
    });

    fireEvent.click(screen.getByRole('button', { name: 'Save Changes' }));

    await waitFor(() => {
      expect(userProfileAPI.updateProfile).toHaveBeenCalledTimes(1);
    });

    expect(await screen.findByText('Profile settings saved successfully.')).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: 'Security' }));

    expect(screen.getByText('Resend verification email is temporarily disabled.')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Resend Verification Email' })).toBeDisabled();
    expect(authAPI.resendVerification).not.toHaveBeenCalled();
  });

  it('provider settings loads current sections and supports account save', async () => {
    getUser.mockReturnValue({
      userType: 'tradesperson',
      fullName: 'Provider User',
      email: 'provider@example.com',
      isVerified: false,
    });

    userProfileAPI.getProfile.mockResolvedValue({
      success: true,
      data: {
        fullName: 'Provider User',
        email: 'provider@example.com',
        phone: '09120000000',
        address: 'Provider Address',
        bio: 'Provider bio',
      },
    });

    userProfileAPI.updateProfile.mockResolvedValue({
      success: true,
      data: {
        fullName: 'Provider User Updated',
        phone: '09120000000',
        address: 'Provider Address',
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

    renderWithProviders(<ServiceProviderSettings />);

    expect(await screen.findByText('Service Provider Settings')).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: 'Business' }));
    expect(await screen.findByText('Business Information')).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: 'Schedule' }));
    expect(await screen.findByText('Schedule & Booking Settings')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Save Changes' })).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: 'Profile Details' }));
    expect(await screen.findByText('Languages Spoken')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Save Changes' })).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: 'Account' }));
    fireEvent.click(screen.getByRole('button', { name: 'Change Password' }));
    expect(mockNavigate).toHaveBeenCalledWith('/forgot-password');

    fireEvent.click(await screen.findByRole('button', { name: 'Save Changes' }));

    await waitFor(() => {
      expect(userProfileAPI.updateProfile).toHaveBeenCalledTimes(1);
    });
  });

  it('admin settings loads metrics and navigates to moderation queue', async () => {
    adminAPI.getDashboardStats.mockResolvedValue({
      success: true,
      data: {
        totalUsers: 6,
        totalClients: 3,
        totalTradespersons: 2,
        totalAdmins: 1,
        verifiedProviders: 1,
        pendingVerifications: 1,
        activeReports: 2,
      },
    });

    adminAPI.getAllUsers.mockResolvedValue({
      success: true,
      data: [
        { id: 1, type: 'tradesperson', isVerified: false, isActive: true },
        { id: 2, type: 'client', isVerified: false, isActive: false },
      ],
    });

    adminAPI.getVerificationRequests.mockResolvedValue({
      success: true,
      data: [{ id: 11, status: 'pending' }, { id: 12, status: 'rejected' }],
    });

    adminAPI.getReports.mockResolvedValue({
      success: true,
      data: [{ id: 21, status: 'pending' }, { id: 22, status: 'under_review' }],
    });

    renderWithProviders(<AdminSettings />);

    expect(await screen.findByText('Admin Settings')).toBeInTheDocument();

    await waitFor(() => {
      expect(adminAPI.getDashboardStats).toHaveBeenCalledTimes(1);
    });

    fireEvent.click(screen.getByRole('button', { name: 'Moderation' }));
    fireEvent.click(await screen.findByRole('button', { name: 'Open Verification Queue' }));

    expect(mockNavigate).toHaveBeenCalledWith('/admin/verifications');

    fireEvent.click(screen.getByRole('button', { name: 'Overview' }));
    fireEvent.click(screen.getByRole('button', { name: 'Refresh Metrics' }));

    await waitFor(() => {
      expect(adminAPI.getDashboardStats).toHaveBeenCalledTimes(2);
    });
  });
});
