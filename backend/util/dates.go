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
