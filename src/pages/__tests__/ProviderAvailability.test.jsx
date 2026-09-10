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
    serviceProfileAPI.saveMyAvailability.mockResolvedValue({ success: true, message: 'Availability saved successfully' });
  });

  it('guides providers to the unified profile when no service profile exists', async () => {
    serviceProfileAPI.getMyAvailability.mockRejectedValueOnce({ status: 404 });
    renderWithAppProviders(<ProviderAvailability />);

    expect(await screen.findByText('Complete your Provider Profile first')).toBeInTheDocument();
    expect(screen.getByText('Add your services and pricing before setting availability.')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Open Provider Profile' })).toHaveAttribute('href', '/provider-credentials#services');
  });

  it('turns a simple weekday preset into explicit dates and saves the same backend payload', async () => {
    renderWithAppProviders(<ProviderAvailability />);

    expect(await screen.findByText('Quick setup')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: /Weekdays/i }));
    fireEvent.click(screen.getByRole('button', { name: /Whole day/i }));

    expect(screen.getByText(/bookable dates selected/i)).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Save Availability' }));

    await waitFor(() => expect(serviceProfileAPI.saveMyAvailability).toHaveBeenCalledTimes(1));
    const payload = serviceProfileAPI.saveMyAvailability.mock.calls[0][0];
    expect(payload.acceptingBookings).toBe(true);
    expect(Array.isArray(payload.availability)).toBe(true);
    expect(payload.availability.length).toBeGreaterThan(0);
    expect(payload.availability[0]).toMatchObject({ startTime: '08:00', endTime: '17:00' });
  });

  it('keeps exact-date and per-date-hour controls hidden until Customize is opened', async () => {
    renderWithAppProviders(<ProviderAvailability />);
    expect(await screen.findByText('Quick setup')).toBeInTheDocument();
    expect(screen.queryByText('Choose exact dates')).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: /Customize specific dates or hours/i }));
    expect(screen.getByText('Choose exact dates')).toBeInTheDocument();
    expect(screen.getByText('Different hours on a specific date')).toBeInTheDocument();
  });
});
