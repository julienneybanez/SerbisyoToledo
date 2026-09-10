import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { DayPicker } from 'react-day-picker';
import 'react-day-picker/style.css';
import { serviceProfileAPI } from '../services/api';
import SettingsFlash from '../components/settings/SettingsFlash';
import { AppButton, AppInput, PageHeader } from '../components/ui';
import { useLanguage } from '../context/LanguageContext';
import './ProviderAvailabilitySimple.css';

const COPY = {
  en: {
    title: 'Availability',
    subtitle: 'Choose when clients are allowed to book you. Start with a simple schedule and customize only when you need to.',
    accepting: 'Accepting bookings',
    acceptingHelp: 'Turn this off when you do not want clients to send new bookings.',
    quick: 'Quick setup',
    quickHelp: 'Choose the schedule that is closest to your normal work week.',
    days: 'Which days do you normally work?',
    weekdays: 'Weekdays',
    weekends: 'Weekends',
    everyDay: 'Every day',
    chooseDates: 'Choose dates myself',
    hours: 'What hours do you normally work?',
    morning: 'Morning · 8 AM–12 PM',
    afternoon: 'Afternoon · 1 PM–5 PM',
    wholeDay: 'Whole day · 8 AM–5 PM',
    customHours: 'Custom hours',
    selectedSummary: '{count} bookable dates selected',
    defaultHours: 'Default hours',
    customize: 'Customize specific dates or hours',
    hideCustomize: 'Hide custom options',
    customizeHelp: 'Use this only if some dates are different from your normal schedule.',
    calendar: 'Choose exact dates',
    calendarHelp: 'Selected dates are the only dates clients can book.',
    perDate: 'Different hours on a specific date',
    perDateHelp: 'Optional. Pick a selected date only when its hours are different from your normal hours.',
    editHours: 'Change hours',
    useDefault: 'Use default',
    saveOverride: 'Save hours',
    noDates: 'No dates selected yet.',
    save: 'Save Availability',
    saving: 'Saving...',
    saved: 'Availability saved. Clients will only see the dates and times you selected.',
    loadFailed: 'Unable to load your availability right now.',
    saveFailed: 'Unable to save your availability right now.',
    selectDateOrPause: 'Choose at least one available date or turn off Accepting bookings.',
    invalidTime: 'End time must be later than start time.',
    listingRequired: 'Complete your Provider Profile first',
    listingRequiredHelp: 'Add your services and pricing before setting availability.',
    goProfile: 'Open Provider Profile',
  },
  ceb: {
    title: 'Availability',
    subtitle: 'Pilia kung kanus-a ka mahimong i-book sa kliyente. Sugdi sa yano nga schedule ug i-customize lang kung kinahanglan.',
    accepting: 'Modawat og booking',
    acceptingHelp: 'I-off kini kung dili ka gusto modawat og bag-ong booking.',
    quick: 'Dali nga setup',
    quickHelp: 'Pilia ang schedule nga pinakaduol sa imong kasagarang semana sa trabaho.',
    days: 'Unsang mga adlaw ka kasagarang motrabaho?',
    weekdays: 'Lunes–Biyernes',
    weekends: 'Weekend',
    everyDay: 'Matag adlaw',
    chooseDates: 'Ako mismo mopili og petsa',
    hours: 'Unsang oras ka kasagarang motrabaho?',
    morning: 'Buntag · 8 AM–12 PM',
    afternoon: 'Hapon · 1 PM–5 PM',
    wholeDay: 'Tibuok adlaw · 8 AM–5 PM',
    customHours: 'Custom nga oras',
    selectedSummary: '{count} ka petsa ang mapili sa booking',
    defaultHours: 'Kasagarang oras',
    customize: 'I-customize ang espesipikong petsa o oras',
    hideCustomize: 'Tagoa ang custom options',
    customizeHelp: 'Gamita lang kini kung adunay petsa nga lahi sa imong kasagarang schedule.',
    calendar: 'Pilia ang eksaktong mga petsa',
    calendarHelp: 'Ang mga napiling petsa ra ang makita ug ma-book sa kliyente.',
    perDate: 'Lahi nga oras sa usa ka petsa',
    perDateHelp: 'Opsyonal. Pilia lang ang petsa kung lahi ang oras niini sa imong kasagarang oras.',
    editHours: 'Usba ang oras',
    useDefault: 'Gamita ang default',
    saveOverride: 'I-save ang oras',
    noDates: 'Wala pay napiling petsa.',
    save: 'I-save ang Availability',
    saving: 'Gi-save...',
    saved: 'Na-save ang availability. Ang napili ra nimong petsa ug oras ang makita sa kliyente.',
    loadFailed: 'Dili ma-load ang imong availability karon.',
    saveFailed: 'Dili ma-save ang imong availability karon.',
    selectDateOrPause: 'Pagpili og labing menos usa ka available nga petsa o i-off ang pagdawat og booking.',
    invalidTime: 'Ang end time kinahanglan mas ulahi sa start time.',
    listingRequired: 'Kompletoha una ang Provider Profile',
    listingRequiredHelp: 'Ibutang una ang imong mga serbisyo ug presyo sa dili pa mag-set og availability.',
    goProfile: 'Ablihi ang Provider Profile',
  },
};

const pad = (value) => String(value).padStart(2, '0');
const toDateKey = (date) => `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
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
const normalizeTime = (value, fallback) => String(value || fallback).slice(0, 5);

function formatTime(value) {
  const [hours, minutes] = String(value || '').split(':').map(Number);
  if (!Number.isFinite(hours) || !Number.isFinite(minutes)) return value || '';
  return new Intl.DateTimeFormat('en-PH', { hour: 'numeric', minute: '2-digit' }).format(new Date(2000, 0, 1, hours, minutes));
}

export default function ProviderAvailability({ embedded = false }) {
  const { language } = useLanguage();
  const text = COPY[language === 'ceb' ? 'ceb' : 'en'];
  const locale = language === 'ceb' ? 'ceb-PH' : 'en-PH';
  const today = useMemo(() => startOfToday(), []);
  const firstBookable = useMemo(() => addDays(today, 1), [today]);
  const lastBookable = useMemo(() => addDays(today, 60), [today]);

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [hasProfile, setHasProfile] = useState(true);
  const [flash, setFlash] = useState({ type: 'info', message: '' });
  const [acceptingBookings, setAcceptingBookings] = useState(true);
  const [selectedDateKeys, setSelectedDateKeys] = useState([]);
  const [dayPreset, setDayPreset] = useState('weekdays');
  const [timePreset, setTimePreset] = useState('whole_day');
  const [defaultStart, setDefaultStart] = useState('08:00');
  const [defaultEnd, setDefaultEnd] = useState('17:00');
  const [overrides, setOverrides] = useState({});
  const [showAdvanced, setShowAdvanced] = useState(false);
  const [editingDate, setEditingDate] = useState('');
  const [editingStart, setEditingStart] = useState('08:00');
  const [editingEnd, setEditingEnd] = useState('17:00');

  useEffect(() => {
    let mounted = true;
    serviceProfileAPI.getMyAvailability()
      .then((response) => {
        if (!mounted || !response?.success) return;
        setHasProfile(true);
        const entries = response.data?.availableSlots || response.data?.availability || response.data?.specificAvailability || [];
        const normalized = (Array.isArray(entries) ? entries : []).map((entry) => ({
          date: String(entry.date || entry.exceptionDate || entry.exception_date || '').slice(0, 10),
          start: normalizeTime(entry.startTime || entry.start_time, '08:00'),
          end: normalizeTime(entry.endTime || entry.end_time, '17:00'),
        })).filter((entry) => entry.date);

        if (normalized.length) {
          const pairCounts = new Map();
          normalized.forEach((entry) => {
            const key = `${entry.start}|${entry.end}`;
            pairCounts.set(key, (pairCounts.get(key) || 0) + 1);
          });
          const defaultPair = [...pairCounts.entries()].sort((a, b) => b[1] - a[1])[0]?.[0] || '08:00|17:00';
          const [start, end] = defaultPair.split('|');
          setDefaultStart(start);
          setDefaultEnd(end);
          setTimePreset(start === '08:00' && end === '12:00' ? 'morning' : start === '13:00' && end === '17:00' ? 'afternoon' : start === '08:00' && end === '17:00' ? 'whole_day' : 'custom');
          setSelectedDateKeys([...new Set(normalized.map((entry) => entry.date))].sort());
          setOverrides(Object.fromEntries(normalized.filter((entry) => `${entry.start}|${entry.end}` !== defaultPair).map((entry) => [entry.date, { startTime: entry.start, endTime: entry.end }])));
          setDayPreset('custom');
        }

        const accepting = response.data?.acceptingBookings ?? (String(response.data?.settings?.availability_status || 'available').toLowerCase() !== 'unavailable');
        setAcceptingBookings(Boolean(accepting));
      })
      .catch((error) => {
        if (!mounted) return;
        if (error?.status === 404) setHasProfile(false);
        else setFlash({ type: 'error', message: text.loadFailed });
      })
      .finally(() => mounted && setLoading(false));

    return () => { mounted = false; };
  }, [text.loadFailed]);

  const selectedDates = useMemo(() => selectedDateKeys.map(fromDateKey).filter(Boolean), [selectedDateKeys]);

  const generatePresetDates = (preset) => {
    if (preset === 'custom') {
      setShowAdvanced(true);
      setDayPreset('custom');
      return;
    }
    const next = [];
    for (const cursor = new Date(firstBookable); cursor <= lastBookable; cursor.setDate(cursor.getDate() + 1)) {
      const day = cursor.getDay();
      if (preset === 'weekdays' && day >= 1 && day <= 5) next.push(toDateKey(cursor));
      if (preset === 'weekends' && (day === 0 || day === 6)) next.push(toDateKey(cursor));
      if (preset === 'every_day') next.push(toDateKey(cursor));
    }
    setDayPreset(preset);
    setSelectedDateKeys(next);
    setOverrides({});
    setEditingDate('');
  };

  const applyTimePreset = (preset) => {
    setTimePreset(preset);
    if (preset === 'morning') { setDefaultStart('08:00'); setDefaultEnd('12:00'); }
    if (preset === 'afternoon') { setDefaultStart('13:00'); setDefaultEnd('17:00'); }
    if (preset === 'whole_day') { setDefaultStart('08:00'); setDefaultEnd('17:00'); }
    if (preset === 'custom') setShowAdvanced(true);
  };

  const editHours = (date) => {
    const current = overrides[date] || { startTime: defaultStart, endTime: defaultEnd };
    setEditingDate(date);
    setEditingStart(current.startTime);
    setEditingEnd(current.endTime);
  };

  const saveOverride = () => {
    if (!editingDate) return;
    if (!editingStart || !editingEnd || editingEnd <= editingStart) {
      setFlash({ type: 'error', message: text.invalidTime });
      return;
    }
    setOverrides((current) => {
      const next = { ...current };
      if (editingStart === defaultStart && editingEnd === defaultEnd) delete next[editingDate];
      else next[editingDate] = { startTime: editingStart, endTime: editingEnd };
      return next;
    });
    setEditingDate('');
  };

  const useDefaultForDate = (date) => {
    setOverrides((current) => {
      const next = { ...current };
      delete next[date];
      return next;
    });
    if (editingDate === date) setEditingDate('');
  };

  const save = async () => {
    if (acceptingBookings && selectedDateKeys.length === 0) {
      setFlash({ type: 'error', message: text.selectDateOrPause });
      return;
    }
    if (!defaultStart || !defaultEnd || defaultEnd <= defaultStart) {
      setFlash({ type: 'error', message: text.invalidTime });
      return;
    }

    try {
      setSaving(true);
      setFlash({ type: 'info', message: '' });
      const availability = selectedDateKeys.map((date) => ({
        date,
        startTime: overrides[date]?.startTime || defaultStart,
        endTime: overrides[date]?.endTime || defaultEnd,
      }));
      await serviceProfileAPI.saveMyAvailability({ acceptingBookings, availability });
      setFlash({ type: 'success', message: text.saved });
    } catch {
      setFlash({ type: 'error', message: text.saveFailed });
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return <div className={`provider-availability-simple ${embedded ? 'embedded' : ''}`}><div className="availability-simple-loading"><span className="spinner-small" /><p>{text.title}...</p></div></div>;
  }

  if (!hasProfile) {
    return (
      <div className={`provider-availability-simple ${embedded ? 'embedded' : ''}`}>
        {!embedded && <PageHeader title={text.title} subtitle={text.subtitle} />}
        <section className="availability-simple-card empty-card">
          <i className="bi bi-person-vcard" />
          <h2>{text.listingRequired}</h2>
          <p>{text.listingRequiredHelp}</p>
          <AppButton as={Link} to="/provider-credentials#services">{text.goProfile}</AppButton>
        </section>
      </div>
    );
  }

  return (
    <div className={`provider-availability-simple ${embedded ? 'embedded' : ''}`}>
      {!embedded && <PageHeader title={text.title} subtitle={text.subtitle} />}
      <SettingsFlash type={flash.type} message={flash.message} />

      <section className="availability-simple-card availability-toggle-card">
        <div><span className="availability-card-icon"><i className="bi bi-calendar2-check" /></span><div><h2>{text.accepting}</h2><p>{text.acceptingHelp}</p></div></div>
        <label className="availability-switch"><input type="checkbox" checked={acceptingBookings} onChange={(event) => setAcceptingBookings(event.target.checked)} /><span /></label>
      </section>

      <section className={`availability-simple-card ${!acceptingBookings ? 'availability-disabled' : ''}`}>
        <div className="availability-simple-heading"><span>1</span><div><h2>{text.quick}</h2><p>{text.quickHelp}</p></div></div>

        <div className="availability-simple-field">
          <label>{text.days}</label>
          <div className="availability-option-grid">
            {[['weekdays', text.weekdays], ['weekends', text.weekends], ['every_day', text.everyDay], ['custom', text.chooseDates]].map(([key, label]) => (
              <button key={key} type="button" className={dayPreset === key ? 'selected' : ''} onClick={() => generatePresetDates(key)} disabled={!acceptingBookings}>
                <i className={`bi ${key === 'weekdays' ? 'bi-briefcase' : key === 'weekends' ? 'bi-sun' : key === 'every_day' ? 'bi-calendar-week' : 'bi-calendar3'}`} />
                <span>{label}</span>
              </button>
            ))}
          </div>
        </div>

        <div className="availability-simple-field">
          <label>{text.hours}</label>
          <div className="availability-time-options">
            {[['morning', text.morning], ['afternoon', text.afternoon], ['whole_day', text.wholeDay], ['custom', text.customHours]].map(([key, label]) => (
              <button key={key} type="button" className={timePreset === key ? 'selected' : ''} onClick={() => applyTimePreset(key)} disabled={!acceptingBookings}>{label}</button>
            ))}
          </div>
          {timePreset === 'custom' && (
            <div className="availability-default-hours">
              <div><label htmlFor="availability-default-start">Start</label><AppInput id="availability-default-start" type="time" value={defaultStart} onChange={(event) => setDefaultStart(event.target.value)} /></div>
              <div><label htmlFor="availability-default-end">End</label><AppInput id="availability-default-end" type="time" value={defaultEnd} onChange={(event) => setDefaultEnd(event.target.value)} /></div>
            </div>
          )}
        </div>

        <div className="availability-summary-strip">
          <span><i className="bi bi-calendar-check" />{text.selectedSummary.replace('{count}', selectedDateKeys.length)}</span>
          <span><i className="bi bi-clock" />{text.defaultHours}: {formatTime(defaultStart)}–{formatTime(defaultEnd)}</span>
        </div>
      </section>

      <section className={`availability-simple-card availability-custom-card ${!acceptingBookings ? 'availability-disabled' : ''}`}>
        <button type="button" className="availability-custom-toggle" onClick={() => setShowAdvanced((value) => !value)} disabled={!acceptingBookings} aria-expanded={showAdvanced}>
          <span><i className="bi bi-sliders" /><span><strong>{showAdvanced ? text.hideCustomize : text.customize}</strong><small>{text.customizeHelp}</small></span></span>
          <i className={`bi bi-chevron-${showAdvanced ? 'up' : 'down'}`} />
        </button>

        {showAdvanced && (
          <div className="availability-advanced-content">
            <div className="availability-calendar-block">
              <div className="availability-simple-heading compact"><span>2</span><div><h2>{text.calendar}</h2><p>{text.calendarHelp}</p></div></div>
              <DayPicker
                mode="multiple"
                selected={selectedDates}
                onSelect={(dates) => {
                  const keys = (Array.isArray(dates) ? dates : []).map(toDateKey).filter((key) => {
                    const date = fromDateKey(key);
                    return date && date >= firstBookable && date <= lastBookable;
                  }).sort();
                  setSelectedDateKeys(keys);
                  setDayPreset('custom');
                  setOverrides((current) => Object.fromEntries(Object.entries(current).filter(([date]) => keys.includes(date))));
                }}
                disabled={[{ before: firstBookable }, { after: lastBookable }]}
                startMonth={firstBookable}
                endMonth={lastBookable}
                showOutsideDays
                fixedWeeks
              />
            </div>

            <div className="availability-date-hours-block">
              <div className="availability-simple-heading compact"><span>3</span><div><h2>{text.perDate}</h2><p>{text.perDateHelp}</p></div></div>
              {selectedDateKeys.length === 0 ? <p className="availability-empty-text">{text.noDates}</p> : (
                <div className="availability-date-list">
                  {selectedDateKeys.slice(0, 12).map((dateKey) => {
                    const date = fromDateKey(dateKey);
                    const hours = overrides[dateKey] || { startTime: defaultStart, endTime: defaultEnd };
                    return (
                      <div key={dateKey} className="availability-date-row">
                        <div><strong>{date?.toLocaleDateString(locale, { month: 'short', day: 'numeric', weekday: 'short' })}</strong><small>{formatTime(hours.startTime)}–{formatTime(hours.endTime)}{overrides[dateKey] ? ' · Custom' : ''}</small></div>
                        <div>
                          <AppButton size="sm" variant="secondary" onClick={() => editHours(dateKey)}>{text.editHours}</AppButton>
                          {overrides[dateKey] && <AppButton size="sm" variant="ghost" onClick={() => useDefaultForDate(dateKey)}>{text.useDefault}</AppButton>}
                        </div>
                      </div>
                    );
                  })}
                  {selectedDateKeys.length > 12 && <p className="availability-more-dates">+{selectedDateKeys.length - 12} more selected dates</p>}
                </div>
              )}

              {editingDate && (
                <div className="availability-override-editor">
                  <strong>{fromDateKey(editingDate)?.toLocaleDateString(locale, { weekday: 'long', month: 'long', day: 'numeric' })}</strong>
                  <div><label>Start</label><AppInput type="time" value={editingStart} onChange={(event) => setEditingStart(event.target.value)} /></div>
                  <div><label>End</label><AppInput type="time" value={editingEnd} onChange={(event) => setEditingEnd(event.target.value)} /></div>
                  <AppButton size="sm" onClick={saveOverride}>{text.saveOverride}</AppButton>
                </div>
              )}
            </div>
          </div>
        )}
      </section>

      <div className="availability-save-bar">
        <div><strong>{text.selectedSummary.replace('{count}', selectedDateKeys.length)}</strong><small>{acceptingBookings ? `${formatTime(defaultStart)}–${formatTime(defaultEnd)}` : text.acceptingHelp}</small></div>
        <AppButton onClick={save} disabled={saving}>{saving ? text.saving : text.save}</AppButton>
      </div>
    </div>
  );
}
