import { useMemo, useState, useCallback } from "react";
import {
  CalendarIcon,
  ClockIcon,
  UserIcon,
  CheckIcon,
  LocationIcon,
  ChevronLeftIcon,
  ChevronRightIcon,
} from "./Icons";
import { serviceRequestAPI, isAuthenticated } from "../../services/api";

const timeSlots = ["9:00 AM", "10:00 AM", "11:00 AM", "1:00 PM", "2:00 PM", "3:00 PM", "4:00 PM"];
const timelineStages = [
  { label: "Schedule", description: "Pick your slot", icon: CalendarIcon },
  { label: "In-Progress", description: "Await confirmation", icon: ClockIcon },
  { label: "Service Completed", description: "Provider wraps up", icon: UserIcon },
];
const weekdayLabels = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
const monthNames = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December"
];

// Helper functions for calendar
const getDaysInMonth = (year, month) => new Date(year, month + 1, 0).getDate();
const getFirstDayOfMonth = (year, month) => new Date(year, month, 1).getDay();

const generateCalendarDays = (year, month) => {
  const daysInMonth = getDaysInMonth(year, month);
  const firstDay = getFirstDayOfMonth(year, month);
  
  const cells = [];
  
  // Add empty cells for days before the first day of the month
  for (let i = 0; i < firstDay; i++) {
    cells.push(null);
  }
  
  // Add the days of the month
  for (let day = 1; day <= daysInMonth; day++) {
    cells.push(day);
  }
  
  // Fill remaining cells to complete the grid
  while (cells.length % 7 !== 0) {
    cells.push(null);
  }
  
  return cells;
};

const isDateAvailable = (year, month, day) => {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  
  const checkDate = new Date(year, month, day);
  checkDate.setHours(0, 0, 0, 0);
  
  // Date must be in the future (at least tomorrow)
  const tomorrow = new Date(today);
  tomorrow.setDate(tomorrow.getDate() + 1);
  
  // Date must be within next 60 days
  const maxDate = new Date(today);
  maxDate.setDate(maxDate.getDate() + 60);
  
  // Check if date is valid (tomorrow to 60 days from now)
  if (checkDate < tomorrow || checkDate > maxDate) {
    return false;
  }
  
  // All weekdays are available (you can customize this if needed)
  return true;
};

export default function BookingModal({ provider, onClose }) {
  const today = new Date();
  const [currentMonth, setCurrentMonth] = useState(today.getMonth());
  const [currentYear, setCurrentYear] = useState(today.getFullYear());
  const [selectedDate, setSelectedDate] = useState(null);
  const [selectedTime, setSelectedTime] = useState("");
  const [step, setStep] = useState(1);
  const [jobTitle, setJobTitle] = useState("");
  const [jobDetails, setJobDetails] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState(null);

  const safeProvider = {
    name: provider?.name ?? "Service Provider",
    profession: provider?.tags?.[0] ?? "Community Services",
    location: provider?.location ?? "Toledo City",
    description:
      provider?.bio ?? provider?.description ?? "Reliable service provider ready to help with your request.",
  };

  const initials = safeProvider.name
    .split(" ")
    .map((part) => part[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();

  const calendarCells = useMemo(
    () => generateCalendarDays(currentYear, currentMonth),
    [currentYear, currentMonth]
  );

  const formattedSelectedDate = useMemo(() => {
    if (!selectedDate) return "";
    return selectedDate.toLocaleDateString("en-US", {
      weekday: "long",
      month: "long",
      day: "numeric",
      year: "numeric",
    });
  }, [selectedDate]);

  const canGoToPrevMonth = useMemo(() => {
    const prevMonth = currentMonth === 0 ? 11 : currentMonth - 1;
    const prevYear = currentMonth === 0 ? currentYear - 1 : currentYear;
    const today = new Date();
    return prevYear > today.getFullYear() || 
           (prevYear === today.getFullYear() && prevMonth >= today.getMonth());
  }, [currentMonth, currentYear]);

  const canGoToNextMonth = useMemo(() => {
    const maxDate = new Date();
    maxDate.setDate(maxDate.getDate() + 60);
    const maxMonth = maxDate.getMonth();
    const maxYear = maxDate.getFullYear();
    return currentYear < maxYear || 
           (currentYear === maxYear && currentMonth < maxMonth);
  }, [currentMonth, currentYear]);

  const handlePrevMonth = useCallback(() => {
    if (!canGoToPrevMonth) return;
    if (currentMonth === 0) {
      setCurrentMonth(11);
      setCurrentYear(currentYear - 1);
    } else {
      setCurrentMonth(currentMonth - 1);
    }
  }, [currentMonth, currentYear, canGoToPrevMonth]);

  const handleNextMonth = useCallback(() => {
    if (!canGoToNextMonth) return;
    if (currentMonth === 11) {
      setCurrentMonth(0);
      setCurrentYear(currentYear + 1);
    } else {
      setCurrentMonth(currentMonth + 1);
    }
  }, [currentMonth, currentYear, canGoToNextMonth]);

  const handleSelectDate = useCallback((day) => {
    if (day && isDateAvailable(currentYear, currentMonth, day)) {
      setSelectedDate(new Date(currentYear, currentMonth, day));
    }
  }, [currentYear, currentMonth]);

  const statusIndex = step >= 4 ? 2 : step === 3 ? 1 : 0;

  const handlePrev = () => setStep((prev) => Math.max(1, prev - 1));
  
  const handleNext = async () => {
    if (step === 3) {
      if (!isAuthenticated()) {
        setSubmitError("Please log in to book a service");
        return;
      }
      
      setSubmitting(true);
      setSubmitError(null);
      
      try {
        // Format the date as YYYY-MM-DD
        const year = selectedDate.getFullYear();
        const month = String(selectedDate.getMonth() + 1).padStart(2, "0");
        const day = String(selectedDate.getDate()).padStart(2, "0");
        const scheduledDate = `${year}-${month}-${day}`;
        
        // provider.userId is the actual user ID from the database
        // provider.id is the service profile ID
        const providerId = provider?.userId;
        const serviceProfileId = provider?.id;
        
        if (!providerId) {
          throw new Error("This is a demo provider. Please browse real service providers to book a service.");
        }
        
        if (!serviceProfileId) {
          throw new Error("Provider information is incomplete. Please try again.");
        }
        
        const response = await serviceRequestAPI.createRequest({
          providerId,
          serviceProfileId,
          jobTitle: jobTitle.trim(),
          jobDetails: jobDetails.trim(),
          scheduledDate,
          scheduledTime: selectedTime,
        });
        
        if (response.success) {
          setStep(4);
        }
      } catch (error) {
        console.error("Booking error:", error);
        setSubmitError(error.message || "Failed to submit booking. Please try again.");
      } finally {
        setSubmitting(false);
      }
      return;
    }
    setStep((prev) => Math.min(prev + 1, 4));
  };

  const canProceed = () => {
    if (step === 1) return selectedDate !== null;
    if (step === 2) return selectedTime !== "";
    if (step === 3) return jobTitle.trim().length > 0 && jobDetails.trim().length > 0;
    return true;
  };

  const renderCalendar = () => {
    const isSelectedDay = (day) => {
      if (!selectedDate || !day) return false;
      return (
        selectedDate.getDate() === day &&
        selectedDate.getMonth() === currentMonth &&
        selectedDate.getFullYear() === currentYear
      );
    };

    return (
      <div className="booking-calendar">
        <div className="calendar-header">
          <button 
            className={`calendar-nav ${!canGoToPrevMonth ? "disabled" : ""}`} 
            type="button" 
            aria-label="Previous month" 
            disabled={!canGoToPrevMonth}
            onClick={handlePrevMonth}
          >
            <ChevronLeftIcon />
          </button>
          <div className="calendar-month">
            <span>{monthNames[currentMonth]} {currentYear}</span>
          </div>
          <button 
            className={`calendar-nav ${!canGoToNextMonth ? "disabled" : ""}`} 
            type="button" 
            aria-label="Next month"
            disabled={!canGoToNextMonth}
            onClick={handleNextMonth}
          >
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

            const isAvailable = isDateAvailable(currentYear, currentMonth, cell);
            const isSelected = isSelectedDay(cell);
            
            return (
              <button
                key={`day-${cell}`}
                type="button"
                className={`calendar-day ${!isAvailable ? "muted" : "available"} ${isSelected ? "selected" : ""}`}
                onClick={() => isAvailable && handleSelectDate(cell)}
                disabled={!isAvailable}
              >
                {cell}
              </button>
            );
          })}
        </div>
      </div>
    );
  };

  const renderStepContent = () => {
    if (step === 1) {
      return (
        <>
          {renderCalendar()}
          <div className="booking-hint-card">
            <p>Select your preferred date to move to the next step.</p>
            <p className="hint-subtext">Available dates are highlighted in blue. You can book up to 60 days in advance.</p>
          </div>
        </>
      );
    }

    if (step === 2) {
      return (
        <>
          {renderCalendar()}
          <div className="booking-time-panel">
            <p className="time-panel-label">{formattedSelectedDate}</p>
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
          {submitError && (
            <div className="booking-error">
              <i className="bi bi-exclamation-circle"></i> {submitError}
            </div>
          )}
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
          <div className="booking-provider-meta">
            <div className="booking-provider-avatar">{initials}</div>
            <p className="booking-provider-profession">{safeProvider.profession}</p>
            <p className="booking-provider-name">{safeProvider.name}</p>
            <p className="booking-provider-location">
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
              <button className="booking-btn booking-btn-outline" onClick={handlePrev} disabled={submitting}>
                Prev
              </button>
            )}

            {step < 4 && (
              <button
                className="booking-btn booking-btn-primary"
                onClick={handleNext}
                disabled={!canProceed() || submitting}
              >
                {submitting ? "Submitting..." : step === 3 ? "Confirm Booking" : "Next"}
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
