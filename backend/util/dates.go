package util

import "time"

// GetMonthStartEnd returns the start and end time of a given month and year.
func GetMonthStartEnd(year int, month int) (time.Time, time.Time) {
	// Start of the month
	start := time.Date(year, time.Month(month), 1, 0, 0, 0, 0, time.UTC)

	// Start of the next month
	end := start.AddDate(0, 1, 0)

	return start, end
}

func GetWeekStartEnd(year int, week int) (time.Time, time.Time) {
	// Find the first day of the year
	firstDay := time.Date(year, 1, 1, 0, 0, 0, 0, time.UTC)

	// Find the first day of the week (Monday)
	offset := int(time.Monday - firstDay.Weekday())
	if offset > 0 {
		offset -= 7
	}
	weekStart := firstDay.AddDate(0, 0, offset+(week-1)*7)

	// The end of the week is 6 days after the start (Sunday)
	weekEnd := weekStart.AddDate(0, 0, 6).Add(24*time.Hour - 1*time.Microsecond)

	return weekStart, weekEnd
}

// StartOfQuarter returns a time corresponding to the start (month=1,4,7,10) of the quarter for t.
func StartOfQuarter(t time.Time) time.Time {
	year, month, _ := t.Date()
	loc := t.Location()

	// Determine which quarter month: (1,4,7,10)
	// e.g., month=2 => quarter start is 1 (January)
	qMonth := ((month-1)/3)*3 + 1

	return time.Date(year, time.Month(qMonth), 1, 0, 0, 0, 0, loc)
}

func EndOfDay(t time.Time) *time.Time {
	year, month, day := t.Date()
	end := time.Date(year, month, day, 23, 59, 59, 999999999, t.Location())
	return &end
}

// EndOfMonth returns the last moment of the month (23:59:59.999999999) for the given time t.
func EndOfMonth(t time.Time) time.Time {
	year, month, _ := t.Date()
	loc := t.Location()

	// Start of next month
	firstOfNextMonth := time.Date(year, month+1, 1, 0, 0, 0, 0, loc)
	// Subtract a nanosecond to get the last instant of the current month
	return firstOfNextMonth.Add(-time.Nanosecond)
}
