const {
  checkScheduleConflict,
  getAvailableSlotsForDate,
  normalizeBookingDates,
  intersectSlotsByTime,
} = require('../utils/bookingAvailability');

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

  it('returns no client slots when the provider has not selected any availability', async () => {
    const connection = {
      query: vi.fn(async (sql) => {
        const text = String(sql);

        if (text.includes('FROM provider_availability_settings') && text.includes('LIMIT 1')) {
          return [[{
            id: 1,
            allow_same_day_booking: 0,
            min_advance_notice_minutes: 720,
            max_advance_booking_days: 60,
            availability_status: 'available',
            show_availability_status: 1,
          }]];
        }

        if (text.includes('FROM provider_weekly_availability') && text.includes('day_of_week')) {
          return [[]];
        }

        if (text.includes('FROM provider_availability_exceptions') && text.includes('exception_date = ?')) {
          return [[]];
        }

        if (text.includes('FROM service_requests')) {
          return [[]];
        }

        return [{ affectedRows: 0 }];
      }),
    };

    const future = new Date(Date.now() + (30 * 24 * 60 * 60 * 1000));
    const date = future.toISOString().slice(0, 10);

    const slots = await getAvailableSlotsForDate(connection, {
      serviceProfileId: 77,
      providerId: 21,
      date,
      durationMinutes: 60,
      slotStepMinutes: 60,
    });

    expect(slots).toEqual([]);
  });

  it('returns every usable slot within the provider-selected availability window', async () => {
    const connection = {
      query: vi.fn(async (sql) => {
        const text = String(sql);

        if (text.includes('FROM provider_availability_settings') && text.includes('LIMIT 1')) {
          return [[{
            id: 1,
            allow_same_day_booking: 1,
            min_advance_notice_minutes: 0,
            max_advance_booking_days: 365,
            availability_status: 'available',
            show_availability_status: 1,
          }]];
        }

        if (text.includes('FROM provider_weekly_availability') && text.includes('day_of_week')) {
          return [[]];
        }

        if (text.includes('FROM provider_availability_exceptions') && text.includes('exception_date = ?')) {
          return [[{
            start_time: '09:00:00',
            end_time: '12:00:00',
            exception_type: 'available',
          }]];
        }

        if (text.includes('FROM service_requests')) {
          return [[]];
        }

        return [{ affectedRows: 0 }];
      }),
    };

    const future = new Date(Date.now() + (30 * 24 * 60 * 60 * 1000));
    const date = future.toISOString().slice(0, 10);

    const slots = await getAvailableSlotsForDate(connection, {
      serviceProfileId: 77,
      providerId: 21,
      date,
      durationMinutes: 60,
      slotStepMinutes: 60,
    });

    expect(slots).toEqual([
      {
        time: '09:00:00',
        endTime: '10:00:00',
      },
      {
        time: '10:00:00',
        endTime: '11:00:00',
      },
      {
        time: '11:00:00',
        endTime: '12:00:00',
      },
    ]);
  });

});

describe('bookingAvailability.normalizeBookingDates', () => {
  it('normalizes one-day bookings to one date', () => {
    expect(normalizeBookingDates({
      bookingType: 'one_day',
      startDate: '2099-12-31',
    })).toEqual(['2099-12-31']);
  });

  it('expands a continuous date range into individual dates', () => {
    expect(normalizeBookingDates({
      bookingType: 'date_range',
      startDate: '2099-12-30',
      endDate: '2100-01-02',
    })).toEqual([
      '2099-12-30',
      '2099-12-31',
      '2100-01-01',
      '2100-01-02',
    ]);
  });

  it('deduplicates and sorts specific dates', () => {
    expect(normalizeBookingDates({
      bookingType: 'specific_dates',
      dates: ['2100-01-05', '2100-01-02', '2100-01-05'],
    })).toEqual(['2100-01-02', '2100-01-05']);
  });
});

describe('bookingAvailability.intersectSlotsByTime', () => {
  it('returns only times available on every selected date', () => {
    expect(intersectSlotsByTime([
      [{ time: '08:00:00' }, { time: '09:00:00' }, { time: '10:00:00' }],
      [{ time: '09:00:00' }, { time: '10:00:00' }, { time: '11:00:00' }],
      [{ time: '09:00:00' }, { time: '10:00:00' }, { time: '14:00:00' }],
    ])).toEqual([{ time: '09:00:00' }, { time: '10:00:00' }]);
  });

  it('returns no slots when any selected date has none', () => {
    expect(intersectSlotsByTime([
      [{ time: '09:00:00' }],
      [],
    ])).toEqual([]);
  });
});
