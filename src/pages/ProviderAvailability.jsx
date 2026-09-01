import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { DayPicker } from 'react-day-picker';
import 'react-day-picker/style.css';
import { serviceProfileAPI } from '../services/api';
import SettingsFlash from '../components/settings/SettingsFlash';
import { AppButton, AppInput, PageHeader } from '../components/ui';
import { useLanguage } from '../context/LanguageContext';
import './ProviderAvailability.css';

const DATE_PRESETS = [
  { key: 'weekdays', labelKey: 'availabilityPresetWeekdays', descriptionKey: 'availabilityPresetWeekdaysDescription' },
  { key: 'weekends', labelKey: 'availabilityPresetWeekends', descriptionKey: 'availabilityPresetWeekendsDescription' },
  { key: 'every_day', labelKey: 'availabilityPresetEveryDay', descriptionKey: 'availabilityPresetEveryDayDescription' },
  { key: 'selected_days', labelKey: 'availabilityPresetSelectedDays', descriptionKey: 'availabilityPresetSelectedDaysDescription' },
];

const TIME_PRESETS = [
  { key: 'morning', labelKey: 'availabilityTimeMorning', startTime: '08:00', endTime: '12:00' },
  { key: 'afternoon', labelKey: 'availabilityTimeAfternoon', startTime: '13:00', endTime: '17:00' },
  { key: 'whole_day', labelKey: 'availabilityTimeWholeDay', startTime: '08:00', endTime: '17:00' },
  { key: 'custom', labelKey: 'availabilityTimeCustom', startTime: null, endTime: null },
];

const getTimePresetKey = (startTime, endTime) => (
  TIME_PRESETS.find((preset) => preset.startTime === startTime && preset.endTime === endTime)?.key || 'custom'
);

const WEEKDAYS = [
  { value: 1, labelKey: 'availabilityDayMon' },
  { value: 2, labelKey: 'availabilityDayTue' },
  { value: 3, labelKey: 'availabilityDayWed' },
  { value: 4, labelKey: 'availabilityDayThu' },
  { value: 5, labelKey: 'availabilityDayFri' },
  { value: 6, labelKey: 'availabilityDaySat' },
  { value: 0, labelKey: 'availabilityDaySun' },
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

const formatDateLabel = (key, locale) => {
  const date = fromDateKey(key);
  if (!date) return key;
  return new Intl.DateTimeFormat(locale, {
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
  const { language, t } = useLanguage();
  const locale = language === 'ceb' ? 'ceb-PH' : 'en-PH';
  const today = useMemo(() => startOfToday(), []);
  const firstBookableDate = useMemo(() => addDays(today, 1), [today]);
  const lastBookableDate = useMemo(() => addDays(today, 60), [today]);

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [hasServiceProfile, setHasServiceProfile] = useState(true);
  const [flash, setFlash] = useState({ type: 'info', message: '' });
  const [acceptingBookings, setAcceptingBookings] = useState(true);
  const [selectedDateKeys, setSelectedDateKeys] = useState([]);
  const [datePreset, setDatePreset] = useState('weekdays');
  const [selectedWeekdays, setSelectedWeekdays] = useState([1, 2, 3, 4, 5]);
  const [timePreset, setTimePreset] = useState('whole_day');
  const [defaultStartTime, setDefaultStartTime] = useState('08:00');
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
        setHasServiceProfile(true);

        const entries = Array.isArray(response.data?.availableSlots)
          ? response.data.availableSlots
          : (Array.isArray(response.data?.availability)
            ? response.data.availability
            : (Array.isArray(response.data?.specificAvailability)
              ? response.data.specificAvailability
              : []));

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
        setTimePreset(getTimePresetKey(hours.startTime, hours.endTime));
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
      } catch (err) {
        if (!mounted) return;
        if (err?.status === 404) {
          setHasServiceProfile(false);
          setFlash({ type: 'info', message: '' });
        } else {
          setFlash({
            type: 'error',
            message: t('availabilityLoadFailed'),
          });
        }
      } finally {
        if (mounted) setLoading(false);
      }
    };

    loadAvailability();
    return () => { mounted = false; };
  }, [firstBookableDate, lastBookableDate, t]);

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
      setFlash({ type: 'error', message: t('availabilityChooseWeekdayError') });
      return;
    }

    if (!defaultStartTime || !defaultEndTime || defaultEndTime <= defaultStartTime) {
      setFlash({ type: 'error', message: t('availabilityInvalidTime') });
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
      message: t('availabilityPresetApplied', { count: generated.length }),
    });
  };

  const clearDates = () => {
    setSelectedDateKeys([]);
    setHourOverrides({});
    setEditingDate('');
    setFlash({ type: 'info', message: t('availabilityDatesCleared') });
  };

  const beginEditHours = (date) => {
    const hours = getEffectiveHours(date);
    setEditingDate(date);
    setEditingHours(hours);
  };

  const saveOverride = () => {
    if (!editingDate) return;
    if (!editingHours.startTime || !editingHours.endTime || editingHours.endTime <= editingHours.startTime) {
      setFlash({ type: 'error', message: t('availabilityEndAfterStart') });
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
        message: t('availabilitySelectDateOrPause'),
      });
      return;
    }

    if (!defaultStartTime || !defaultEndTime || defaultEndTime <= defaultStartTime) {
      setFlash({ type: 'error', message: t('availabilityInvalidDefaultTime') });
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
      await serviceProfileAPI.saveMyAvailability({
        acceptingBookings,
        availability,
      });

      setFlash({
        type: 'success',
        message: t('availabilitySaveSuccess'),
      });
    } catch {
      setFlash({
        type: 'error',
        message: t('availabilitySaveFailed'),
      });
    } finally {
      setSaving(false);
    }
  };

  if (!loading && !hasServiceProfile) {
    return (
      <div className="provider-availability-page">
        <div className="provider-availability-inner">
          <PageHeader
            title={t('availabilityPageTitle')}
            subtitle={t('availabilityPageSubtitle')}
            className="availability-page-header"
          />

          <section className="availability-card">
            <div className="availability-card-heading">
              <div>
                <span className="availability-step" aria-hidden="true">
                  <i className="bi bi-briefcase"></i>
                </span>
                <h2>{t('availabilityListingRequiredTitle')}</h2>
              </div>
            </div>
            <p>{t('availabilityListingRequiredDescription')}</p>
            <AppButton as={Link} to="/dashboard">
              {t('availabilityGoToDashboard')}
            </AppButton>
          </section>
        </div>
      </div>
    );
  }

  return (
    <div className="provider-availability-page">
      <div className="provider-availability-inner">
        <PageHeader
          title={t('availabilityPageTitle')}
          subtitle={t('availabilityPageSubtitle')}
          className="availability-page-header"
        />

        <SettingsFlash type={flash.type} message={flash.message} />

        <section className="availability-card availability-status-card">
          <div className="availability-status-copy">
            <div className="availability-section-icon" aria-hidden="true">
              <i className="bi bi-calendar2-check"></i>
            </div>
            <div>
              <h2>{t('availabilityAcceptingBookings')}</h2>
              <p>{acceptingBookings ? t('availabilityAcceptingOnDescription') : t('availabilityAcceptingOffDescription')}</p>
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
            <strong>{acceptingBookings ? t('on') : t('off')}</strong>
          </label>
        </section>

        <section className="availability-card">
          <div className="availability-card-heading">
            <div>
              <span className="availability-step">1</span>
              <h2>{t('availabilityQuickSetup')}</h2>
            </div>
            <p>{t('availabilityQuickSetupDescription')}</p>
          </div>

          <div className="availability-field-group">
            <label className="availability-label">{t('availabilityAvailableDays')}</label>
            <div className="availability-preset-grid">
              {DATE_PRESETS.map((preset) => (
                <button
                  key={preset.key}
                  type="button"
                  className={`availability-preset ${datePreset === preset.key ? 'active' : ''}`}
                  onClick={() => setDatePreset(preset.key)}
                  disabled={loading || saving}
                >
                  <strong>{t(preset.labelKey)}</strong>
                  <span>{t(preset.descriptionKey)}</span>
                </button>
              ))}
            </div>
          </div>

          {datePreset === 'selected_days' && (
            <div className="availability-field-group">
              <label className="availability-label">{t('availabilityChooseWeekdays')}</label>
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
                    {t(day.labelKey)}
                  </button>
                ))}
              </div>
            </div>
          )}

          <div className="availability-field-group">
            <label className="availability-label">{t('availabilityUsualHours')}</label>
            <div className="availability-time-presets">
              {TIME_PRESETS.map((preset) => (
                <button
                  key={preset.key}
                  type="button"
                  className={timePreset === preset.key ? 'active' : ''}
                  onClick={() => handleTimePreset(preset)}
                  disabled={loading || saving}
                >
                  {t(preset.labelKey)}
                </button>
              ))}
            </div>

            {timePreset === 'custom' && (
              <div className="availability-time-row">
                <label>
                  <span>{t('start')}</span>
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
                <span className="availability-time-separator">{t('to')}</span>
                <label>
                  <span>{t('end')}</span>
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
            )}
          </div>

          <div className="availability-system-rule">
            <i className="bi bi-info-circle" aria-hidden="true"></i>
            <span>{t('availabilitySystemRule')}</span>
          </div>

          <AppButton
            onClick={applyPreset}
            disabled={loading || saving}
            icon={<i className="bi bi-lightning-charge-fill" aria-hidden="true"></i>}
          >
            {t('availabilityApplyPreset')}
          </AppButton>
        </section>

        <section className="availability-card">
          <div className="availability-card-heading availability-calendar-heading">
            <div>
              <span className="availability-step">2</span>
              <h2>{t('availabilityYourDates')}</h2>
            </div>
            <div className="availability-selected-count">
              <strong>{selectedDateKeys.length}</strong>
              <span>{t('selected')}</span>
            </div>
          </div>

          <p className="availability-calendar-help">
            {t('availabilityCalendarHelp')}
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
            <details className="availability-date-adjustments">
              <summary>
                <span>{t('availabilitySelectedDates')}</span>
                <span className="availability-adjustments-summary">{customHoursCount > 0 ? t('availabilityCustomHoursCount', { count: customHoursCount }) : t('availabilityAllUsualHours')}</span>
              </summary>
              <div className="availability-list-section">
              <div className="availability-list-heading">
                <div>
                  <h3>{t('availabilitySelectedDates')}</h3>
                  <p>{customHoursCount > 0 ? t('availabilityCustomHoursCount', { count: customHoursCount }) : t('availabilityAllUsualHours')}</p>
                </div>
                <AppButton variant="ghost" size="sm" onClick={clearDates}>
                  {t('availabilityClearDates')}
                </AppButton>
              </div>

              <div className="availability-date-list">
                {selectedDateKeys.map((date) => {
                  const hours = getEffectiveHours(date);
                  const hasOverride = Boolean(hourOverrides[date]);
                  const isEditing = editingDate === date;

                  return (
                    <div className="availability-date-row" key={date}>
                      <div className="availability-date-copy">
                        <strong>{formatDateLabel(date, locale)}</strong>
                        <span>
                          {formatTimeLabel(hours.startTime)} – {formatTimeLabel(hours.endTime)}
                          {hasOverride && <em>{t('availabilityCustomBadge')}</em>}
                        </span>
                      </div>

                      {isEditing ? (
                        <div className="availability-date-editor">
                          <AppInput
                            type="time"
                            value={editingHours.startTime}
                            onChange={(event) => setEditingHours((current) => ({
                              ...current,
                              startTime: event.target.value,
                            }))}
                          />
                          <span>{t('to')}</span>
                          <AppInput
                            type="time"
                            value={editingHours.endTime}
                            onChange={(event) => setEditingHours((current) => ({
                              ...current,
                              endTime: event.target.value,
                            }))}
                          />
                          <AppButton size="sm" onClick={saveOverride}>{t('save')}</AppButton>
                          <AppButton variant="secondary" size="sm" onClick={() => setEditingDate('')}>{t('cancel')}</AppButton>
                        </div>
                      ) : (
                        <div className="availability-date-actions">
                          <AppButton variant="secondary" size="sm" onClick={() => beginEditHours(date)}>
                            {t('availabilityChangeTime')}
                          </AppButton>
                          {hasOverride && (
                            <AppButton variant="ghost" size="sm" onClick={() => resetOverride(date)}>
                              {t('availabilityUseUsualHours')}
                            </AppButton>
                          )}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
              </div>
            </details>
          )}
        </section>

        <div className="availability-save-bar">
          <div>
            <strong>{acceptingBookings ? t('availabilityReady') : t('availabilityPaused')}</strong>
            <span>
              {acceptingBookings
                ? t('availabilityVisibleDatesCount', { count: selectedDateKeys.length })
                : t('availabilityPausedDescription')}
            </span>
          </div>
          <AppButton
            onClick={handleSave}
            disabled={loading || saving}
          >
            {saving ? (
              <>
                <span className="availability-spinner" aria-hidden="true"></span>
                {t('availabilitySaving')}
              </>
            ) : (
              <>
                <i className="bi bi-check2-circle" aria-hidden="true"></i>
                {t('availabilitySave')}
              </>
            )}
          </AppButton>
        </div>
      </div>
    </div>
  );
}
