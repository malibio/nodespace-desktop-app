import { render, screen, fireEvent } from '@testing-library/react';
import { vi } from 'vitest';
import { DateNavigationBar } from './DateNavigationBar';

describe('DateNavigationBar', () => {
  const mockOnDateChange = vi.fn();
  const testDate = new Date('2024-06-23');

  beforeEach(() => {
    mockOnDateChange.mockClear();
  });

  it('renders the date header correctly', () => {
    render(
      <DateNavigationBar 
        selectedDate={testDate} 
        onDateChange={mockOnDateChange} 
      />
    );
    
    expect(screen.getByText(/Jun 23/)).toBeInTheDocument();
  });

  it('shows "Today" when the selected date is today', () => {
    const today = new Date();
    render(
      <DateNavigationBar 
        selectedDate={today} 
        onDateChange={mockOnDateChange} 
      />
    );
    
    // Check specifically for the "Today" text in the header
    expect(screen.getByRole('heading', { name: /Today/ })).toBeInTheDocument();
  });

  it('navigates to previous day when left arrow is clicked', () => {
    render(
      <DateNavigationBar 
        selectedDate={testDate} 
        onDateChange={mockOnDateChange} 
      />
    );
    
    const prevButton = screen.getByLabelText('Go to previous day');
    fireEvent.click(prevButton);
    
    expect(mockOnDateChange).toHaveBeenCalledWith(
      new Date('2024-06-22')
    );
  });

  it('navigates to next day when right arrow is clicked', () => {
    render(
      <DateNavigationBar 
        selectedDate={testDate} 
        onDateChange={mockOnDateChange} 
      />
    );
    
    const nextButton = screen.getByLabelText('Go to next day');
    fireEvent.click(nextButton);
    
    expect(mockOnDateChange).toHaveBeenCalledWith(
      new Date('2024-06-24')
    );
  });

  it('navigates to today when Today button is clicked', () => {
    render(
      <DateNavigationBar 
        selectedDate={testDate} 
        onDateChange={mockOnDateChange} 
      />
    );
    
    const todayButton = screen.getByLabelText('Go to today');
    fireEvent.click(todayButton);
    
    // Should call onDateChange with a date that matches today
    expect(mockOnDateChange).toHaveBeenCalled();
    const calledDate = mockOnDateChange.mock.calls[0][0];
    const today = new Date();
    expect(calledDate.toDateString()).toBe(today.toDateString());
  });

  it('toggles date picker when calendar button is clicked', () => {
    render(
      <DateNavigationBar 
        selectedDate={testDate} 
        onDateChange={mockOnDateChange} 
      />
    );
    
    const calendarButton = screen.getByLabelText('Open calendar picker');
    
    // Date picker should not be visible initially
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    
    // Click to show date picker
    fireEvent.click(calendarButton);
    
    // Date picker should now be visible
    expect(document.querySelector('.react-datepicker')).toBeInTheDocument();
  });
});