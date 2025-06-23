import React, { useState } from 'react';
import DatePicker from 'react-datepicker';
import 'react-datepicker/dist/react-datepicker.css';
import './DateNavigationBar.css';

interface DateNavigationBarProps {
  selectedDate: Date;
  onDateChange: (date: Date) => void;
}

export const DateNavigationBar: React.FC<DateNavigationBarProps> = ({
  selectedDate,
  onDateChange,
}) => {
  const [showDatePicker, setShowDatePicker] = useState(false);

  const formatDateHeader = (date: Date): string => {
    const today = new Date();
    const isToday = date.toDateString() === today.toDateString();
    
    if (isToday) {
      return `Today, ${date.toLocaleDateString('en-US', { 
        weekday: 'short', 
        month: 'short', 
        day: 'numeric' 
      })}`;
    }
    
    return date.toLocaleDateString('en-US', { 
      weekday: 'short', 
      month: 'short', 
      day: 'numeric',
      year: 'numeric'
    });
  };

  const goToPreviousDay = () => {
    const previousDay = new Date(selectedDate);
    previousDay.setDate(selectedDate.getDate() - 1);
    onDateChange(previousDay);
  };

  const goToNextDay = () => {
    const nextDay = new Date(selectedDate);
    nextDay.setDate(selectedDate.getDate() + 1);
    onDateChange(nextDay);
  };

  const goToToday = () => {
    onDateChange(new Date());
  };

  return (
    <div className="date-navigation-bar">
      <div className="date-header">
        <h2>{formatDateHeader(selectedDate)}</h2>
      </div>
      
      <div className="date-controls">
        <button 
          className="nav-button" 
          onClick={goToPreviousDay}
          title="Previous day"
          aria-label="Go to previous day"
        >
          ←
        </button>
        
        <button 
          className="nav-button" 
          onClick={goToNextDay}
          title="Next day"
          aria-label="Go to next day"
        >
          →
        </button>
        
        <button 
          className="today-button" 
          onClick={goToToday}
          title="Go to today"
          aria-label="Go to today"
        >
          Today
        </button>
        
        <button 
          className="calendar-button" 
          onClick={() => setShowDatePicker(!showDatePicker)}
          title="Open calendar"
          aria-label="Open calendar picker"
        >
          📅
        </button>
      </div>
      
      {showDatePicker && (
        <div className="date-picker-container">
          <DatePicker
            selected={selectedDate}
            onChange={(date: Date | null) => {
              if (date) {
                onDateChange(date);
                setShowDatePicker(false);
              }
            }}
            inline
            showMonthDropdown
            showYearDropdown
            dropdownMode="select"
          />
        </div>
      )}
    </div>
  );
};