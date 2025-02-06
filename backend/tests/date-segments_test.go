package tests

import (
	"analytics/file-catalog"
	"testing"
	"time"
)

func Test(t *testing.T) {
	testTime := time.Date(2024, 2, 5, 5, 1, 2, 0, time.UTC)
	cutoff := testTime.AddDate(-2, 0, 0)
	segments := file_catalog.GenerateTimeFragments(testTime, cutoff)

	expectedData := []struct {
		StartDate string
		EndDate   string
	}{
		{"2022-01-01 00:00:00 +0000 UTC", "2022-03-31 23:59:59.999999999 +0000 UTC"},
		{"2022-04-01 00:00:00 +0000 UTC", "2022-06-30 23:59:59.999999999 +0000 UTC"},
		{"2022-07-01 00:00:00 +0000 UTC", "2022-09-30 23:59:59.999999999 +0000 UTC"},
		{"2022-10-01 00:00:00 +0000 UTC", "2022-12-31 23:59:59.999999999 +0000 UTC"},
		{"2023-01-01 00:00:00 +0000 UTC", "2023-03-31 23:59:59.999999999 +0000 UTC"},
		{"2023-04-01 00:00:00 +0000 UTC", "2023-06-30 23:59:59.999999999 +0000 UTC"},
		{"2023-07-01 00:00:00 +0000 UTC", "2023-09-30 23:59:59.999999999 +0000 UTC"},
		{"2023-10-01 00:00:00 +0000 UTC", "2023-12-31 23:59:59.999999999 +0000 UTC"},
		{"2024-01-01 00:00:00 +0000 UTC", "2024-01-31 23:59:59.999999999 +0000 UTC"},
		{"2024-02-01 00:00:00 +0000 UTC", "2024-02-05 05:01:02 +0000 UTC"},
	}

	for i, expected := range expectedData {
		if segments[i].StartDate.String() != expected.StartDate || segments[i].EndDate.String() != expected.EndDate {
			t.Errorf("Segment %d mismatch: got (%s - %s), expected (%s - %s)",
				i, segments[i].StartDate, segments[i].EndDate, expected.StartDate, expected.EndDate)
		}
	}
}
