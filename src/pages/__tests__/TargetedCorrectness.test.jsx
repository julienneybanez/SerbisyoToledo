import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import '@testing-library/jest-dom/vitest';
import { MemoryRouter } from 'react-router-dom';
import Feed from '../Feed';
import ServiceProviderDashboard from '../ServiceProviderDashboard';
import AdminUsers from '../admin/AdminUsers';
import { LanguageProvider } from '../../context/LanguageContext';
import { adminAPI, getUser, isAuthenticated, serviceProfileAPI, serviceRequestAPI } from '../../services/api';

const mockNavigate = vi.fn();
const setSearchParamsMock = vi.fn();
let searchParamsValue = new URLSearchParams('');

vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual('react-router-dom');
  return {
    ...actual,
    useNavigate: () => mockNavigate,
    useSearchParams: () => [searchParamsValue, setSearchParamsMock],
  };
});

vi.mock('../../services/api', () => ({
  getUser: vi.fn(),
  isAuthenticated: vi.fn(),
  serviceProfileAPI: {
    getAllProfiles: vi.fn(),
    getMyProfile: vi.fn(),
    getMyPortfolio: vi.fn(),
  },
  serviceRequestAPI: {
    getClientRequests: vi.fn(),
    getProviderRequests: vi.fn(),
    updateStatus: vi.fn(),
  },
  adminAPI: {
    getAllUsers: vi.fn(),
    getUserById: vi.fn(),
    updateUserStatus: vi.fn(),
    getUserActivity: vi.fn(),
  },
}));

describe('Targeted correctness checks', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    searchParamsValue = new URLSearchParams('');

    getUser.mockReturnValue({ userType: 'client', fullName: 'Client User', email: 'client@example.com' });
    isAuthenticated.mockReturnValue(false);

    serviceProfileAPI.getAllProfiles.mockResolvedValue({ success: true, data: [] });
    serviceRequestAPI.getClientRequests.mockResolvedValue({ success: true, data: { requests: [] } });

    serviceProfileAPI.getMyProfile.mockResolvedValue({ success: true, data: {} });
    serviceProfileAPI.getMyPortfolio.mockResolvedValue({ success: true, data: {} });
  });

  it('clears search, category, and advanced filters together on Feed', async () => {
    searchParamsValue = new URLSearchParams('q=plumber&category=Plumbing');

    render(
      <MemoryRouter>
        <LanguageProvider>
          <Feed />
        </LanguageProvider>
      </MemoryRouter>,
    );

    await waitFor(() => {
      expect(serviceProfileAPI.getAllProfiles).toHaveBeenCalled();
    });

    fireEvent.click(screen.getByRole('button', { name: /^Filters$/i }));

    fireEvent.change(screen.getByLabelText('Search by service, provider, or location'), {
      target: { value: 'electrician' },
    });

    fireEvent.change(screen.getByPlaceholderText('Enter location'), {
      target: { value: 'Toledo' },
    });

    fireEvent.click(screen.getByRole('button', { name: 'Clear Filters' }));

    expect(screen.getByLabelText('Search by service, provider, or location')).toHaveValue('');
    expect(screen.getByPlaceholderText('Enter location')).toHaveValue('');

    const lastCall = setSearchParamsMock.mock.calls.at(-1);
    expect(lastCall).toBeTruthy();
    expect(lastCall[0].toString()).toBe('');
  });

  it('computes Active Jobs from full request data, not from the 4-card slice', async () => {
    getUser.mockReturnValue({ userType: 'tradesperson', fullName: 'Provider User' });

    serviceRequestAPI.getProviderRequests.mockResolvedValue({
      success: true,
      data: {
        requests: [
          { id: 1, status: 'pending' },
          { id: 2, status: 'pending' },
          { id: 3, status: 'accepted', scheduled_start_at: '2099-01-01T09:00:00.000Z' },
          { id: 4, status: 'on_the_way', scheduled_start_at: '2099-01-01T10:00:00.000Z' },
          { id: 5, status: 'in_progress', scheduled_start_at: '2099-01-01T11:00:00.000Z' },
          { id: 6, status: 'completed' },
        ],
      },
    });

    render(
      <MemoryRouter>
        <ServiceProviderDashboard />
      </MemoryRouter>,
    );

    const activeLabel = await screen.findByText('Active Jobs');
    expect(activeLabel.nextElementSibling).toHaveTextContent('3');
  });

  it('applies admin user status filters with distinct pending and verified behavior', async () => {
    adminAPI.getAllUsers.mockResolvedValue({
      success: true,
      data: [
        { id: 1, name: 'Alice Verified', email: 'alice@example.com', type: 'tradesperson', isActive: true, isVerified: true },
        { id: 2, name: 'Ben Pending', email: 'ben@example.com', type: 'tradesperson', isActive: true, isVerified: false },
        { id: 3, name: 'Cara Suspended', email: 'cara@example.com', type: 'client', isActive: false, isVerified: true },
      ],
    });

    render(
      <LanguageProvider>
        <AdminUsers />
      </LanguageProvider>,
    );

    await screen.findAllByText('Alice Verified');

    const statusFilter = screen.getAllByRole('combobox')[1];

    fireEvent.change(statusFilter, { target: { value: 'pending' } });
    expect(screen.getAllByText('Ben Pending').length).toBeGreaterThan(0);
    expect(screen.queryAllByText('Alice Verified')).toHaveLength(0);
    expect(screen.queryAllByText('Cara Suspended')).toHaveLength(0);

    fireEvent.change(statusFilter, { target: { value: 'verified' } });
    expect(screen.getAllByText('Alice Verified').length).toBeGreaterThan(0);
    expect(screen.queryAllByText('Ben Pending')).toHaveLength(0);
    expect(screen.queryAllByText('Cara Suspended')).toHaveLength(0);
  });
});
