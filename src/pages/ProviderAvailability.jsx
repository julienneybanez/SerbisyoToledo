import { useEffect, useMemo, useState } from 'react';
import { DayPicker } from 'react-day-picker';
import 'react-day-picker/style.css';
import { serviceProfileAPI } from '../services/api';
import SettingsFlash from '../components/settings/SettingsFlash';
import { PageHeader } from '../components/ui';
import './ProviderAvailability.css';

const DATE_PRESETS = [
  { key: 'weekdays', label: 'Weekdays', description: 'Monday to Friday' },
  { key: 'weekends', label: 'Weekends', description: 'Saturday and Sunday' },
  { key: 'every_day', label: 'Every Day', description: 'All days' },
  { key: 'selected_days', label: 'Selected Days', description: 'Choose weekdays' },
];

const TIME_PRESETS = [
  { key: 'morning', label: 'Morning', startTime: '08:00', endTime: '12:00' },
  { key: 'afternoon', label: 'Afternoon', startTime: '13:00', endTime: '17:00' },
  { key: 'whole_day', label: 'Whole Day', startTime: '08:00', endTime: '17:00' },
  { key: 'custom', label: 'Custom', startTime: null, endTime: null },
];

const WEEKDAYS = [
  { value: 1, short: 'Mon' },
  { value: 2, short: 'Tue' },
  { value: 3, short: 'Wed' },
  { value: 4, short: 'Thu' },
  { value: 5, short: 'Fri' },
  { value: 6, short: 'Sat' },
  { value: 0, short: 'Sun' },
];

const pad = (value) => String(value).padStart(2, '0');

const toDateKey = (date) => {
  if (!(date instanceof Date) || Number.isNaN(date.getTime())) return '';
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
};

const fromDateKey = (key) => {
  const match = String(key || '').match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (!match) return null;
  const date = new Date(Number(match[1]), Number(match[2]) - 1, Number(match[3]));
  return Number.isNaN(date.getTime()) ? null : date;
};

const startOfToday = () => {
  const date = new Date();
  date.setHours(0, 0, 0, 0);
  return date;
};

const addDays = (date, amount) => {
  const next = new Date(date);
  next.setDate(next.getDate() + amount);
  return next;
};

const formatDateLabel = (key) => {
  const date = fromDateKey(key);
  if (!date) return key;
  return new Intl.DateTimeFormat('en-PH', {
    weekday: 'short',
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  }).format(date);
};

const formatTimeLabel = (value) => {
  const [hourRaw, minuteRaw] = String(value || '').split(':');
  const hour = Number(hourRaw);
  const minute = Number(minuteRaw);
  if (!Number.isInteger(hour) || !Number.isInteger(minute)) return value || '';
  const date = new Date(2000, 0, 1, hour, minute);
  return new Intl.DateTimeFormat('en-PH', {
    hour: 'numeric',
    minute: '2-digit',
  }).format(date);
};

function inferHours(entries = []) {
  if (!Array.isArray(entries) || entries.length === 0) {
    return {
      startTime: '09:00',
      endTime: '17:00',
      overrides: {},
    };
  }

  const counts = new Map();
  entries.forEach((entry) => {
    const startTime = String(entry.startTime || entry.start_time || '').slice(0, 5);
    const endTime = String(entry.endTime || entry.end_time || '').slice(0, 5);
    if (!startTime || !endTime) return;
    const pair = `${startTime}|${endTime}`;
    counts.set(pair, (counts.get(pair) || 0) + 1);
  });

  const defaultPair = [...counts.entries()]
    .sort((a, b) => b[1] - a[1])[0]?.[0] || '09:00|17:00';
  const [startTime, endTime] = defaultPair.split('|');

  const overrides = {};
  entries.forEach((entry) => {
    const date = String(entry.date || entry.exceptionDate || entry.exception_date || '').slice(0, 10);
    const entryStart = String(entry.startTime || entry.start_time || '').slice(0, 5);
    const entryEnd = String(entry.endTime || entry.end_time || '').slice(0, 5);
    if (date && entryStart && entryEnd && `${entryStart}|${entryEnd}` !== defaultPair) {
      overrides[date] = { startTime: entryStart, endTime: entryEnd };
    }
  });

  return { startTime, endTime, overrides };
}

export default function ProviderAvailability() {
  const today = useMemo(() => startOfToday(), []);
  const firstBookableDate = useMemo(() => addDays(today, 1), [today]);
  const lastBookableDate = useMemo(() => addDays(today, 60), [today]);

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [flash, setFlash] = useState({ type: 'info', message: '' });
  const [acceptingBookings, setAcceptingBookings] = useState(true);
  const [selectedDateKeys, setSelectedDateKeys] = useState([]);
  const [datePreset, setDatePreset] = useState('weekdays');
  const [selectedWeekdays, setSelectedWeekdays] = useState([1, 2, 3, 4, 5]);
  const [timePreset, setTimePreset] = useState('custom');
  const [defaultStartTime, setDefaultStartTime] = useState('09:00');
  const [defaultEndTime, setDefaultEndTime] = useState('17:00');
  const [hourOverrides, setHourOverrides] = useState({});
  const [editingDate, setEditingDate] = useState('');
  const [editingHours, setEditingHours] = useState({ startTime: '09:00', endTime: '17:00' });

  useEffect(() => {
    let mounted = true;

    const loadAvailability = async () => {
      try {
        setLoading(true);
        const response = await serviceProfileAPI.getMyAvailability();
        if (!mounted || !response?.success) return;

        const entries = Array.isArray(response.data?.availability)
          ? response.data.availability
          : (Array.isArray(response.data?.specificAvailability)
            ? response.data.specificAvailability
            : []);

        const normalizedEntries = entries
          .map((entry) => ({
            date: String(entry.date || entry.exceptionDate || entry.exception_date || '').slice(0, 10),
            startTime: String(entry.startTime || entry.start_time || '').slice(0, 5),
            endTime: String(entry.endTime || entry.end_time || '').slice(0, 5),
          }))
          .filter((entry) => entry.date && entry.startTime && entry.endTime);

        const hours = inferHours(normalizedEntries);
        setDefaultStartTime(hours.startTime);
        setDefaultEndTime(hours.endTime);
        setHourOverrides(hours.overrides);
        setSelectedDateKeys(
          [...new Set(normalizedEntries.map((entry) => entry.date))]
            .filter((key) => {
              const date = fromDateKey(key);
              return date && date >= firstBookableDate && date <= lastBookableDate;
            })
            .sort()
        );

        const accepting = response.data?.acceptingBookings
          ?? (String(response.data?.settings?.availability_status || 'available').toLowerCase() !== 'unavailable');
        setAcceptingBookings(Boolean(accepting));
      } catch (error) {
        setFlash({
          type: 'error',
          message: error?.message || 'Unable to load availability right now.',
        });
      } finally {
        if (mounted) setLoading(false);
      }
    };

    loadAvailability();
    return () => { mounted = false; };
  }, [firstBookableDate, lastBookableDate]);

  const selectedDates = useMemo(
    () => selectedDateKeys.map(fromDateKey).filter(Boolean),
    [selectedDateKeys]
  );

  const customHoursCount = useMemo(
    () => selectedDateKeys.filter((date) => hourOverrides[date]).length,
    [hourOverrides, selectedDateKeys]
  );

  const getEffectiveHours = (date) => (
    hourOverrides[date] || {
      startTime: defaultStartTime,
      endTime: defaultEndTime,
    }
  );

  const handleTimePreset = (preset) => {
    setTimePreset(preset.key);
    if (preset.startTime && preset.endTime) {
      setDefaultStartTime(preset.startTime);
      setDefaultEndTime(preset.endTime);
    }
  };

  const handleDaySelection = (dates) => {
    const nextKeys = (Array.isArray(dates) ? dates : [])
      .map(toDateKey)
      .filter(Boolean)
      .sort();

    setSelectedDateKeys(nextKeys);
    setHourOverrides((current) => Object.fromEntries(
      Object.entries(current).filter(([date]) => nextKeys.includes(date))
    ));
    setFlash({ type: 'info', message: '' });
  };

  const matchesPreset = (date) => {
    const day = date.getDay();

    if (datePreset === 'weekdays') return day >= 1 && day <= 5;
    if (datePreset === 'weekends') return day === 0 || day === 6;
    if (datePreset === 'every_day') return true;
    if (datePreset === 'selected_days') return selectedWeekdays.includes(day);
    return false;
  };

  const applyPreset = () => {
    if (datePreset === 'selected_days' && selectedWeekdays.length === 0) {
      setFlash({ type: 'error', message: 'Choose at least one weekday for this preset.' });
      return;
    }

    if (!defaultStartTime || !defaultEndTime || defaultEndTime <= defaultStartTime) {
      setFlash({ type: 'error', message: 'Choose a valid start and end time.' });
      return;
    }

    const generated = [];
    for (
      let cursor = new Date(firstBookableDate);
      cursor <= lastBookableDate;
      cursor.setDate(cursor.getDate() + 1)
    ) {
      if (matchesPreset(cursor)) generated.push(toDateKey(cursor));
    }

    setSelectedDateKeys(generated);
    setHourOverrides({});
    setEditingDate('');
    setFlash({
      type: 'success',
      message: `${generated.length} available date${generated.length === 1 ? '' : 's'} selected. You can adjust them in the calendar.`,
    });
  };

  const clearDates = () => {
    setSelectedDateKeys([]);
    setHourOverrides({});
    setEditingDate('');
    setFlash({ type: 'info', message: 'Available dates cleared.' });
  };

  const beginEditHours = (date) => {
    const hours = getEffectiveHours(date);
    setEditingDate(date);
    setEditingHours(hours);
  };

  const saveOverride = () => {
    if (!editingDate) return;
    if (!editingHours.startTime || !editingHours.endTime || editingHours.endTime <= editingHours.startTime) {
      setFlash({ type: 'error', message: 'The end time must be later than the start time.' });
      return;
    }

    const isDefault = (
      editingHours.startTime === defaultStartTime
      && editingHours.endTime === defaultEndTime
    );

    setHourOverrides((current) => {
      const next = { ...current };
      if (isDefault) delete next[editingDate];
      else next[editingDate] = { ...editingHours };
      return next;
    });
    setEditingDate('');
    setFlash({ type: 'info', message: '' });
  };

  const resetOverride = (date) => {
    setHourOverrides((current) => {
      const next = { ...current };
      delete next[date];
      return next;
    });
    if (editingDate === date) setEditingDate('');
  };

  const handleSave = async () => {
    if (acceptingBookings && selectedDateKeys.length === 0) {
      setFlash({
        type: 'error',
        message: 'Select at least one available date, or turn off Accepting Bookings.',
      });
      return;
    }

    if (!defaultStartTime || !defaultEndTime || defaultEndTime <= defaultStartTime) {
      setFlash({ type: 'error', message: 'Choose a valid default start and end time.' });
      return;
    }

    const availability = selectedDateKeys.map((date) => {
      const hours = getEffectiveHours(date);
      return {
        date,
        startTime: hours.startTime,
        endTime: hours.endTime,
      };
    });

    try {
      setSaving(true);
      setFlash({ type: 'info', message: '' });
      const response = await serviceProfileAPI.saveMyAvailability({
        acceptingBookings,
        availability,
      });

      setFlash({
        type: 'success',
        message: response?.message || 'Availability saved successfully.',
      });
    } catch (error) {
      setFlash({
        type: 'error',
        message: error?.message || 'Unable to save availability right now.',
      });
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="provider-availability-page">
      <div className="provider-availability-inner">
        <PageHeader
          title="Availability"
          subtitle="Choose when clients can request your services. Presets make setup faster, and you can adjust any date afterward."
          className="availability-page-header"
        />

        <SettingsFlash type={flash.type} message={flash.message} />

        <section className="availability-card availability-status-card">
          <div className="availability-status-copy">
            <div className="availability-section-icon" aria-hidden="true">
              <i className="bi bi-calendar2-check"></i>
            </div>
            <div>
              <h2>Accepting Bookings</h2>
              <p>{acceptingBookings ? 'Clients can request the dates you make available.' : 'New booking dates are hidden from clients until you turn this back on.'}</p>
            </div>
          </div>

          <label className="availability-switch">
            <input
              type="checkbox"
              checked={acceptingBookings}
              onChange={(event) => setAcceptingBookings(event.target.checked)}
              disabled={loading || saving}
            />
            <span aria-hidden="true"></span>
            <strong>{acceptingBookings ? 'On' : 'Off'}</strong>
          </label>
        </section>

        <section className="availability-card">
          <div className="availability-card-heading">
            <div>
              <span className="availability-step">1</span>
              <h2>Quick Setup</h2>
            </div>
            <p>Pick a preset, then adjust individual dates in the calendar.</p>
          </div>

          <div className="availability-field-group">
            <label className="availability-label">Available days</label>
            <div className="availability-preset-grid">
              {DATE_PRESETS.map((preset) => (
                <button
                  key={preset.key}
                  type="button"
                  className={`availability-preset ${datePreset === preset.key ? 'active' : ''}`}
                  onClick={() => setDatePreset(preset.key)}
                  disabled={loading || saving}
                >
                  <strong>{preset.label}</strong>
                  <span>{preset.description}</span>
                </button>
              ))}
            </div>
          </div>

          {datePreset === 'selected_days' && (
            <div className="availability-field-group">
              <label className="availability-label">Choose weekdays</label>
              <div className="availability-weekday-row">
                {WEEKDAYS.map((day) => (
                  <button
                    key={day.value}
                    type="button"
                    className={selectedWeekdays.includes(day.value) ? 'selected' : ''}
                    onClick={() => setSelectedWeekdays((current) => (
                      current.includes(day.value)
                        ? current.filter((value) => value !== day.value)
                        : [...current, day.value]
                    ))}
                  >
                    {day.short}
                  </button>
                ))}
              </div>
            </div>
          )}

          <div className="availability-field-group">
            <label className="availability-label">Usual working hours</label>
            <div className="availability-time-presets">
              {TIME_PRESETS.map((preset) => (
                <button
                  key={preset.key}
                  type="button"
                  className={timePreset === preset.key ? 'active' : ''}
                  onClick={() => handleTimePreset(preset)}
                  disabled={loading || saving}
                >
                  {preset.label}
                </button>
              ))}
            </div>

            <div className="availability-time-row">
              <label>
                <span>Start</span>
                <input
                  type="time"
                  value={defaultStartTime}
                  onChange={(event) => {
                    setDefaultStartTime(event.target.value);
                    setTimePreset('custom');
                  }}
                  disabled={loading || saving}
                />
              </label>
              <span className="availability-time-separator">to</span>
              <label>
                <span>End</span>
                <input
                  type="time"
                  value={defaultEndTime}
                  onChange={(event) => {
                    setDefaultEndTime(event.target.value);
                    setTimePreset('custom');
                  }}
                  disabled={loading || saving}
                />
              </label>
            </div>
          </div>

          <div className="availability-system-rule">
            <i className="bi bi-info-circle" aria-hidden="true"></i>
            <span>Clients can book starting tomorrow, up to 60 days ahead. The system also prevents conflicting booked times automatically.</span>
          </div>

          <button
            type="button"
            className="availability-primary-button"
            onClick={applyPreset}
            disabled={loading || saving}
          >
            <i className="bi bi-lightning-charge-fill" aria-hidden="true"></i>
            Apply Preset
          </button>
        </section>

        <section className="availability-card">
          <div className="availability-card-heading availability-calendar-heading">
            <div>
              <span className="availability-step">2</span>
              <h2>Your Available Dates</h2>
            </div>
            <div className="availability-selected-count">
              <strong>{selectedDateKeys.length}</strong>
              <span>selected</span>
            </div>
          </div>

          <p className="availability-calendar-help">
            Tap a date to add or remove it. Preset dates are already highlighted.
          </p>

          <div className="availability-calendar-shell">
            <DayPicker
              mode="multiple"
              selected={selectedDates}
              onSelect={handleDaySelection}
              disabled={{ before: firstBookableDate, after: lastBookableDate }}
              startMonth={firstBookableDate}
              endMonth={lastBookableDate}
              showOutsideDays
            />
          </div>

          {selectedDateKeys.length > 0 && (
            <div className="availability-list-section">
              <div className="availability-list-heading">
                <div>
                  <h3>Selected dates</h3>
                  <p>{customHoursCount > 0 ? `${customHoursCount} date${customHoursCount === 1 ? '' : 's'} with different hours` : 'All dates use your usual working hours.'}</p>
                </div>
                <button type="button" className="availability-text-button" onClick={clearDates}>
                  Clear dates
                </button>
              </div>

              <div className="availability-date-list">
                {selectedDateKeys.map((date) => {
                  const hours = getEffectiveHours(date);
                  const hasOverride = Boolean(hourOverrides[date]);
                  const isEditing = editingDate === date;

                  return (
                    <div className="availability-date-row" key={date}>
                      <div className="availability-date-copy">
                        <strong>{formatDateLabel(date)}</strong>
                        <span>
                          {formatTimeLabel(hours.startTime)} – {formatTimeLabel(hours.endTime)}
                          {hasOverride && <em>Custom</em>}
                        </span>
                      </div>

                      {isEditing ? (
                        <div className="availability-date-editor">
                          <input
                            type="time"
                            value={editingHours.startTime}
                            onChange={(event) => setEditingHours((current) => ({
                              ...current,
                              startTime: event.target.value,
                            }))}
                          />
                          <span>to</span>
                          <input
                            type="time"
                            value={editingHours.endTime}
                            onChange={(event) => setEditingHours((current) => ({
                              ...current,
                              endTime: event.target.value,
                            }))}
                          />
                          <button type="button" onClick={saveOverride}>Save</button>
                          <button type="button" className="subtle" onClick={() => setEditingDate('')}>Cancel</button>
                        </div>
                      ) : (
                        <div className="availability-date-actions">
                          <button type="button" onClick={() => beginEditHours(date)}>
                            Change time
                          </button>
                          {hasOverride && (
                            <button type="button" className="subtle" onClick={() => resetOverride(date)}>
                              Use usual hours
                            </button>
                          )}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </section>

        <div className="availability-save-bar">
          <div>
            <strong>{acceptingBookings ? 'Ready to accept bookings' : 'Bookings paused'}</strong>
            <span>
              {acceptingBookings
                ? `${selectedDateKeys.length} date${selectedDateKeys.length === 1 ? '' : 's'} will be visible to clients.`
                : 'Your dates are saved but hidden while bookings are paused.'}
            </span>
          </div>
          <button
            type="button"
            className="availability-save-button"
            onClick={handleSave}
            disabled={loading || saving}
          >
            {saving ? (
              <>
                <span className="availability-spinner" aria-hidden="true"></span>
                Saving...
              </>
            ) : (
              <>
                <i className="bi bi-check2-circle" aria-hidden="true"></i>
                Save Availability
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
}
