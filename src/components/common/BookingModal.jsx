import { useMemo, useState } from "react";
import {
  CalendarIcon,
  ClockIcon,
  UserIcon,
  CheckIcon,
  LocationIcon,
  ChevronLeftIcon,
  ChevronRightIcon,
} from "./Icons";
import logo from "../../assets/logo.png";

const calendarCells = (() => {
  const blanks = Array.from({ length: new Date(2026, 0, 1).getDay() }, () => null);
  const days = Array.from({ length: 31 }, (_, idx) => idx + 1);
  const filled = [...blanks, ...days];
  while (filled.length % 7 !== 0) {
    filled.push(null);
  }
  return filled;
})();

const availableDays = new Set([15, 16, 17, 26, 27, 28, 29, 30, 31]);
const timeSlots = ["9:00 AM", "11:00 AM", "1:30 PM", "3:00 PM"];
const timelineStages = [
  { label: "Schedule", description: "Pick your slot", icon: CalendarIcon },
  { label: "In-Progress", description: "Await confirmation", icon: ClockIcon },
  { label: "Service Completed", description: "Provider wraps up", icon: UserIcon },
];
const weekdayLabels = ["Sun.", "Mon.", "Tues.", "Wed.", "Thurs.", "Fr.", "Sat."];

export default function BookingModal({ provider, onClose }) {
  const [step, setStep] = useState(1);
  const [selectedDay, setSelectedDay] = useState(29);
  const [selectedTime, setSelectedTime] = useState("1:30 PM");
  const [jobTitle, setJobTitle] = useState("Custom shelf for bedroom");
  const [jobDetails, setJobDetails] = useState("I want a custom shelf for my bed, wall-mounted. Please confirm if materials are included.");

  const safeProvider = {
    name: provider?.name ?? "Service Provider",
    profession: provider?.tags?.[0] ?? "Community Services",
    location: provider?.location ?? "Toledo City",
    description:
      provider?.description ?? "Reliable barangay partner ready to help with your request.",
  };

  const initials = safeProvider.name
    .split(" ")
    .map((part) => part[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();

  const formattedDate = useMemo(() => {
    const date = new Date(`2026-01-${String(selectedDay).padStart(2, "0")}`);
    return date.toLocaleDateString("en-US", {
      weekday: "long",
      month: "long",
      day: "numeric",
    });
  }, [selectedDay]);

  const statusIndex = step >= 4 ? 2 : step === 3 ? 1 : 0;

  const handlePrev = () => setStep((prev) => Math.max(1, prev - 1));
  const handleNext = () => {
    if (step === 3) {
      setStep(4);
      return;
    }
    setStep((prev) => Math.min(prev + 1, 4));
  };

  const canProceed = () => {
    if (step === 1) return Boolean(selectedDay);
    if (step === 2) return Boolean(selectedTime);
    if (step === 3) return jobTitle.trim().length > 0 && jobDetails.trim().length > 0;
    return true;
  };

  const renderCalendar = () => (
    <div className="booking-calendar">
      <div className="calendar-header">
        <button className="calendar-nav disabled" type="button" aria-label="Previous month" disabled>
          <ChevronLeftIcon />
        </button>
        <div className="calendar-month">
          <span>January 2026</span>
        </div>
        <button className="calendar-nav" type="button" aria-label="Next month">
          <ChevronRightIcon />
        </button>
      </div>
      <div className="calendar-weekdays">
        {weekdayLabels.map((day) => (
          <span key={day} className="weekday">
            {day}
          </span>
        ))}
      </div>
      <div className="calendar-grid">
        {calendarCells.map((cell, index) => {
          if (!cell) {
            return <span key={`empty-${index}`} className="calendar-day empty"></span>;
          }

          const isDisabled = !availableDays.has(cell);
          const isSelected = selectedDay === cell;
          return (
            <button
              key={cell}
              type="button"
              className={`calendar-day ${isDisabled ? "muted" : "available"} ${isSelected ? "selected" : ""}`}
              onClick={() => !isDisabled && setSelectedDay(cell)}
              disabled={isDisabled}
            >
              {cell}
            </button>
          );
        })}
      </div>
    </div>
  );

  const renderStepContent = () => {
    if (step === 1) {
      return (
        <>
          {renderCalendar()}
          <div className="booking-hint-card">
            <p>Select your preferred date to move to the next step.</p>
            <p className="hint-subtext">Dates in blue are the provider's open schedule for January.</p>
          </div>
        </>
      );
    }

    if (step === 2) {
      return (
        <>
          {renderCalendar()}
          <div className="booking-time-panel">
            <p className="time-panel-label">{formattedDate}</p>
            <div className="time-slots">
              {timeSlots.map((slot) => (
                <button
                  key={slot}
                  type="button"
                  className={`time-slot ${selectedTime === slot ? "selected" : ""}`}
                  onClick={() => setSelectedTime(slot)}
                >
                  {slot}
                </button>
              ))}
            </div>
          </div>
        </>
      );
    }

    if (step === 3) {
      return (
        <form className="booking-form" onSubmit={(e) => e.preventDefault()}>
          <div className="booking-form-group">
            <label>Job</label>
            <input
              className="booking-input"
              value={jobTitle}
              onChange={(e) => setJobTitle(e.target.value)}
              placeholder="What do you need?"
            />
          </div>
          <div className="booking-form-group">
            <label>Details</label>
            <textarea
              className="booking-textarea"
              rows={5}
              value={jobDetails}
              onChange={(e) => setJobDetails(e.target.value)}
              placeholder="Share specific instructions or your address."
            />
          </div>
        </form>
      );
    }

    return (
      <div className="booking-success">
        <div className="success-icon">
          <CheckIcon />
        </div>
        <h3>Request sent</h3>
        <p>Your request has been sent to the service provider. Please wait for the confirmation.</p>
      </div>
    );
  };

  return (
    <div className="booking-overlay" role="dialog" aria-modal="true" onClick={onClose}>
      <div className="booking-modal" onClick={(e) => e.stopPropagation()}>
        <aside className="booking-sidebar">
          <div className="booking-brand-badge">
            <img src={logo} alt="Serbisyo Toledo" />
          </div>
          <div className="booking-provider-meta">
            <div className="booking-provider-avatar">{initials}</div>
            <p className="booking-provider-profession">{safeProvider.profession}</p>
            <p className="booking-provider-name">{safeProvider.name}</p>
            <p className="booking-provider-location">
              <span className="status-dot"></span>
              <LocationIcon /> {safeProvider.location}
            </p>
            <p className="booking-provider-bio">{safeProvider.description}</p>
          </div>
          <div className="booking-stepper">
            {timelineStages.map((stage, index) => {
              const Icon = stage.icon;
              const state = index < statusIndex ? "completed" : index === statusIndex ? "active" : "";
              return (
                <div key={stage.label} className={`booking-stage ${state}`}>
                  <div className={`stage-indicator ${state}`}>
                    <Icon />
                  </div>
                  <div>
                    <p className="stage-label">{stage.label}</p>
                    <p className="stage-description">{stage.description}</p>
                  </div>
                </div>
              );
            })}
          </div>
        </aside>

        <section className="booking-content">
          <button className="booking-close" onClick={onClose} aria-label="Close booking modal">
            X
          </button>
          <div className="booking-header">
            <h2 className="booking-title">Booking</h2>
            <p className="booking-subtitle">
              {step === 4
                ? "All set! Feel free to close this window."
                : step === 3
                ? "Share the specifics so the provider can prepare."
                : "Pick a date and time that works for you."}
            </p>
          </div>

          <div className={`booking-stage-content ${step <= 2 ? "two-column" : ""}`}>
            {renderStepContent()}
          </div>

          <div className="booking-actions">
            {step > 1 && step < 4 && (
              <button className="booking-btn booking-btn-outline" onClick={handlePrev}>
                Prev
              </button>
            )}

            {step < 4 && (
              <button
                className="booking-btn booking-btn-primary"
                onClick={handleNext}
                disabled={!canProceed()}
              >
                {step === 3 ? "Confirm Booking" : "Next"}
              </button>
            )}

            {step === 4 && (
              <button className="booking-btn booking-btn-primary" onClick={onClose}>
                Close
              </button>
            )}
          </div>
        </section>
      </div>
    </div>
  );
}
