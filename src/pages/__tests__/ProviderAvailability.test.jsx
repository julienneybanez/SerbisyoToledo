import { fireEvent, screen, waitFor } from '@testing-library/react';
import '@testing-library/jest-dom/vitest';
import ProviderAvailability from '../ProviderAvailability';
import { serviceProfileAPI } from '../../services/api';
import { renderWithAppProviders } from '../../test/testUtils';

vi.mock('../../services/api', () => ({
  serviceProfileAPI: {
    getMyAvailability: vi.fn(),
    saveMyAvailability: vi.fn(),
  },
}));

describe('ProviderAvailability', () => {
  beforeEach(() => {
    vi.clearAllMocks();

    serviceProfileAPI.getMyAvailability.mockResolvedValue({
      success: true,
      data: {
        acceptingBookings: true,
        availableSlots: [],
        systemRules: {
          allowSameDayBooking: false,
          minAdvanceNoticeMinutes: 720,
          maxAdvanceBookingDays: 60,
        },
      },
    });

    serviceProfileAPI.saveMyAvailability.mockResolvedValue({
      success: true,
      message: 'Availability saved successfully',
    });
  });

  it('shows a service-listing prerequisite instead of a load error when no listing exists', async () => {
    serviceProfileAPI.getMyAvailability.mockRejectedValueOnce({ status: 404 });

    renderWithAppProviders(<ProviderAvailability />);

    expect(await screen.findByText('Post your service listing first')).toBeInTheDocument();
    expect(screen.getByText(/Availability is connected to your service listing/i)).toBeInTheDocument();
    expect(screen.queryByText('Unable to load availability right now.')).not.toBeInTheDocument();
  });

  it('turns a quick preset into explicit dates and saves the simplified payload', async () => {
    renderWithAppProviders(<ProviderAvailability />);

    expect(await screen.findByText('Availability')).toBeInTheDocument();
    expect(screen.getByText('Weekdays')).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: 'Whole Day' }));
    fireEvent.click(screen.getByRole('button', { name: /Apply Preset/i }));

    expect(await screen.findByText(/available date\(s\) selected/i)).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: /Save Availability/i }));

    await waitFor(() => {
      expect(serviceProfileAPI.saveMyAvailability).toHaveBeenCalledTimes(1);
    });

    const payload = serviceProfileAPI.saveMyAvailability.mock.calls[0][0];
    expect(payload.acceptingBookings).toBe(true);
    expect(Array.isArray(payload.availability)).toBe(true);
    expect(payload.availability.length).toBeGreaterThan(0);
    expect(payload.availability[0]).toMatchObject({
      startTime: '08:00',
      endTime: '17:00',
    });
  });
});
