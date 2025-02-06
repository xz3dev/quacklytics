package filecatalog

import (
	"analytics/log"
	"gorm.io/gorm"
	"time"
)

func GenerateParquetFiles(projectId string, db *gorm.DB) error {
	now := time.Now()
	cutoff := now.AddDate(-2, 0, 0)
	segments := GenerateTimeFragments(now, cutoff)

	filenames := make([]string, len(segments))
	for i, segment := range segments {
		filenames[i] = segment.Filename
	}

	existing, err := ListAll(db)
	if err != nil {
		return err
	}

	existingFilenames := make(map[string]bool, len(existing))
	for _, entry := range existing {
		existingFilenames[entry.Name] = true
	}

	log.Info("Found %d existing files", len(existing))

	var missingSegments []DataSegment
	for _, segment := range segments {
		if !existingFilenames[segment.Filename] {
			missingSegments = append(missingSegments, segment)
		}
	}

	log.Info("Found %d missing files", len(missingSegments))

	for _, segment := range missingSegments {
		ExportEventsToParquet(projectId, db, segment)
	}

	return nil
}
