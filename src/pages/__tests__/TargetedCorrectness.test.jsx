import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import '@testing-library/jest-dom/vitest';
import { MemoryRouter } from 'react-router-dom';
import Feed from '../Feed';
import ServiceProviderDashboard from '../ServiceProviderDashboard';
import ClientDashboard from '../ClientDashboard';
import AdminUsers from '../admin/AdminUsers';
import { LanguageProvider } from '../../context/LanguageContext';
import { adminAPI, getUser, isAuthenticated, serviceProfileAPI, serviceRequestAPI } from '../../services/api';
import { renderWithAppProviders } from '../../test/testUtils';

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
  authAPI: {
    getMe: vi.fn(),
  },
  serviceProfileAPI: {
    getAllProfiles: vi.fn(),
    getMyProfile: vi.fn(),
    getMyPortfolio: vi.fn(),
    getMyAvailability: vi.fn(),
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
    serviceProfileAPI.getMyAvailability.mockResolvedValue({ success: true, data: { weeklyBlocks: [] } });
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

    fireEvent.click(screen.getByRole('button', { name: /^Filters/i }));

    fireEvent.change(screen.getByLabelText('Search by service, provider, or location'), {
      target: { value: 'electrician' },
    });

    fireEvent.change(screen.getByPlaceholderText('Enter location'), {
      target: { value: 'Toledo' },
    });

    const clearAdvancedFilters = screen.getAllByRole('button', { name: 'Clear Filters' })
      .find((button) => button.classList.contains('clear-filters-btn'));
    fireEvent.click(clearAdvancedFilters);

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

    renderWithAppProviders(<ServiceProviderDashboard />);

    const activeLabel = await screen.findByText('Active Jobs');
    expect(activeLabel.previousElementSibling).toHaveTextContent('3');
  });

  it('treats canonical availableSlots as completed provider availability', async () => {
    getUser.mockReturnValue({
      id: 7,
      userType: 'tradesperson',
      fullName: 'Provider User',
      isVerified: true,
    });

    serviceProfileAPI.getMyProfile.mockResolvedValue({
      success: true,
      data: {
        id: 9,
        categories: ['Plumbing'],
        description: 'Experienced local plumber.',
        startingPrice: 500,
        location: 'Poblacion',
      },
    });
    serviceProfileAPI.getMyPortfolio.mockResolvedValue({
      success: true,
      data: {
        aboutMe: 'Experienced local plumber.',
        portfolio: [],
      },
    });
    serviceProfileAPI.getMyAvailability.mockResolvedValue({
      success: true,
      data: {
        acceptingBookings: true,
        availableSlots: [
          { date: '2099-01-02', startTime: '08:00', endTime: '17:00' },
        ],
      },
    });
    serviceRequestAPI.getProviderRequests.mockResolvedValue({
      success: true,
      data: { requests: [] },
    });

    renderWithAppProviders(<ServiceProviderDashboard />);

    expect(await screen.findByText('Upload portfolio work')).toBeInTheDocument();
    expect(screen.queryByText('Set your availability')).not.toBeInTheDocument();
  });

  it('shows canonical request dates and times in the provider work queue', async () => {
    getUser.mockReturnValue({
      id: 7,
      userType: 'tradesperson',
      fullName: 'Provider User',
      isVerified: true,
    });

    serviceRequestAPI.getProviderRequests.mockResolvedValue({
      success: true,
      data: {
        requests: [
          {
            id: 77,
            status: 'accepted',
            client_name: 'Lili Client',
            service_display_label: 'Pipe Repair & Installation',
            booking_dates: ['2099-01-02'],
            start_date: '2099-01-02',
            end_date: '2099-01-02',
            start_time: '09:00',
          },
        ],
      },
    });

    renderWithAppProviders(<ServiceProviderDashboard />);

    expect((await screen.findAllByText('Pipe Repair & Installation')).length).toBeGreaterThan(0);
    expect(screen.getAllByText(/Jan 2, 2099.*9:00 AM/).length).toBeGreaterThan(0);
    expect(screen.queryByText('Schedule not set')).not.toBeInTheDocument();
  });

  it('shows the client workspace summary and current request', async () => {
    getUser.mockReturnValue({ userType: 'client', fullName: 'Client User' });
    serviceRequestAPI.getClientRequests.mockResolvedValue({
      success: true,
      data: {
        requests: [
          {
            id: 44,
            status: 'accepted',
            provider_name: 'Juan Provider',
            service_display_label: 'Plumbing Repair',
            start_date: '2099-01-02',
            start_time: '09:00',
          },
        ],
      },
    });

    renderWithAppProviders(<ClientDashboard />);

    expect(await screen.findByText('Plumbing Repair')).toBeInTheDocument();
    expect(screen.getByText('Active Requests').previousElementSibling).toHaveTextContent('1');
    expect(screen.getByRole('link', { name: /Find a Service/i })).toHaveAttribute('href', '/feed');
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
