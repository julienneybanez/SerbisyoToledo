const { checkScheduleConflict } = require('../utils/bookingAvailability');

const createConnection = (rows) => ({
  query: vi.fn(async () => [rows]),
});

describe('bookingAvailability.checkScheduleConflict', () => {
  it('treats adjacent one-day bookings as non-conflicting', async () => {
    const connection = createConnection([
      {
        id: 1,
        effective_start_date: '2099-12-31',
        effective_end_date: '2099-12-31',
        effective_start_time: '09:00:00',
        estimated_duration_minutes: 120,
        scheduled_start_at: '2099-12-31 09:00:00',
        scheduled_end_at: '2099-12-31 11:00:00',
      },
    ]);

    const result = await checkScheduleConflict(connection, {
      providerId: 77,
      requestedStartDate: '2099-12-31',
      requestedEndDate: '2099-12-31',
      requestedStartTime: '11:00:00',
      requestedDurationMinutes: 60,
    });

    expect(result.conflict).toBe(false);
  });

  it('detects overlap for one-day bookings', async () => {
    const connection = createConnection([
      {
        id: 2,
        effective_start_date: '2099-12-31',
        effective_end_date: '2099-12-31',
        effective_start_time: '09:00:00',
        estimated_duration_minutes: 120,
        scheduled_start_at: '2099-12-31 09:00:00',
        scheduled_end_at: '2099-12-31 11:00:00',
      },
    ]);

    const result = await checkScheduleConflict(connection, {
      providerId: 77,
      requestedStartDate: '2099-12-31',
      requestedEndDate: '2099-12-31',
      requestedStartTime: '10:00:00',
      requestedDurationMinutes: 60,
    });

    expect(result.conflict).toBe(true);
    expect(result.conflictRequestId).toBe(2);
  });

  it('uses estimated duration when stored timestamps are zero-length', async () => {
    const connection = createConnection([
      {
        id: 3,
        effective_start_date: '2099-12-31',
        effective_end_date: '2099-12-31',
        effective_start_time: '09:00:00',
        estimated_duration_minutes: 120,
        scheduled_start_at: '2099-12-31 09:00:00',
        scheduled_end_at: '2099-12-31 09:00:00',
      },
    ]);

    const result = await checkScheduleConflict(connection, {
      providerId: 77,
      requestedStartDate: '2099-12-31',
      requestedEndDate: '2099-12-31',
      requestedStartTime: '10:30:00',
      requestedDurationMinutes: 60,
    });

    expect(result.conflict).toBe(true);
    expect(result.conflictRequestId).toBe(3);
  });

  it('treats overlapping multi-day ranges as conflicts', async () => {
    const connection = createConnection([
      {
        id: 4,
        effective_start_date: '2099-12-30',
        effective_end_date: '2100-01-02',
        effective_start_time: '09:00:00',
        estimated_duration_minutes: 120,
        scheduled_start_at: '2099-12-30 09:00:00',
        scheduled_end_at: '2100-01-02 09:00:00',
      },
    ]);

    const result = await checkScheduleConflict(connection, {
      providerId: 77,
      requestedStartDate: '2100-01-01',
      requestedEndDate: '2100-01-03',
      requestedStartTime: '09:00:00',
      requestedDurationMinutes: 120,
    });

    expect(result.conflict).toBe(true);
    expect(result.conflictRequestId).toBe(4);
  });
});
