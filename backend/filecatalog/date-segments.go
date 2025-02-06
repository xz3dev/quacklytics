package filecatalog

import (
	"analytics/util"
	"fmt"
	"time"
)

// DataSegment holds the time range and an example generated filename.
// You can extend this with checksums, etc.
type DataSegment struct {
	StartDate  time.Time
	EndDate    time.Time
	ValidUntil *time.Time
	Filename   string
}

// GenerateTimeFragments returns a list of DataSegments
//   - Older data (fully past quarters) is grouped into quarterly segments.
//   - The current quarter is split into monthly segments.
func GenerateTimeFragments(now time.Time, cutoff time.Time) []DataSegment {
	var segments []DataSegment

	// 1) Collect quarterly segments from 'cutoff' up to (but not including) the current quarter start.
	// 2) Collect monthly segments for the current quarter.

	currentQuarterStart := util.StartOfQuarter(now)

	// Add quarterly segments from the earliest quarter that intersects our cutoff
	// up to the quarter before the current quarter.
	quarterStart := util.StartOfQuarter(cutoff)

	// If 'cutoff' is in the middle of a quarter,
	// we start that first segment partially at 'cutoff' rather than the full quarter start.
	for quarterStart.Before(currentQuarterStart) {
		qEnd := quarterStart.AddDate(0, 3, 0).Add(-time.Nanosecond)

		// If the next quarter would cross into the current quarter, break out.
		if !qEnd.Before(currentQuarterStart) {
			break
		}

		// The actual start for this segment might be 'cutoff' if we're in a partial quarter at the boundary.
		segStart := quarterStart

		// Only proceed if the segment is fully before currentQuarterStart.
		// End date is whichever is earlier: qEnd or currentQuarterStart-1ns (should never exceed).
		segEnd := qEnd
		if segEnd.After(currentQuarterStart) {
			segEnd = currentQuarterStart.Add(-time.Nanosecond)
		}

		// Build the quarterly segment
		segments = append(segments, DataSegment{
			StartDate:  segStart,
			EndDate:    segEnd,
			ValidUntil: nil,
			Filename:   makeQuarterFilename(quarterStart),
		})

		// Move to the next quarter
		quarterStart = quarterStart.AddDate(0, 3, 0)
	}

	// 2) Add monthly segments for the current quarter:
	// from currentQuarterStart up to "now" (potentially partial).
	m := currentQuarterStart
	currentQuarterEnd := currentQuarterStart.AddDate(0, 3, 0).Add(-time.Nanosecond)

	for m.Before(now) && m.Before(currentQuarterEnd) {
		monthEnd := util.EndOfMonth(m)
		validUntil := &currentQuarterEnd
		if monthEnd.After(now) {
			monthEnd = now
			validUntil = util.EndOfDay(now)
		}

		segments = append(segments, DataSegment{
			StartDate:  m,
			EndDate:    monthEnd,
			Filename:   makeMonthFilename(m),
			ValidUntil: validUntil,
		})

		// Advance to the next month
		m = m.AddDate(0, 1, 0)
	}

	return segments
}

// makeQuarterFilename generates a filename like "2025-q1.parquet"
func makeQuarterFilename(qStart time.Time) string {
	y, m, _ := qStart.Date()
	quarterNumber := ((m - 1) / 3) + 1
	return fmt.Sprintf("%04d-q%d.parquet", y, quarterNumber)
}

// makeMonthFilename generates a filename like "2025-month-01.parquet"
func makeMonthFilename(t time.Time) string {
	y, m, _ := t.Date()
	return fmt.Sprintf("%04d-month-%02d.parquet", y, m)
}
