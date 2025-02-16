package actions

import (
	"analytics/config"
	"analytics/filecatalog"
	"analytics/log"
	"analytics/model"
	"gorm.io/gorm"
	"os"
	"path"
	"time"
)

func GenerateParquetFiles(projectId string, db *gorm.DB) error {
	now := time.Now()
	cutoff := now.AddDate(-2, 0, 0)
	segments := filecatalog.GenerateTimeFragments(now, cutoff)

	filenames := make([]string, len(segments))
	for i, segment := range segments {
		filenames[i] = segment.Filename
	}

	existing, err := filecatalog.ListAll(db)
	if err != nil {
		return err
	}

	existingFilenames := make(map[string]bool, len(existing))
	dir := path.Join(config.Config.Paths.Parquet, projectId)
	now = time.Now().Add(-1 * time.Minute)
	for _, entry := range existing {
		_, err := os.Stat(path.Join(dir, entry.Name))
		if err != nil {
			if !os.IsNotExist(err) {
				log.Warn("Could not stat file %s: %s", entry.Name, err)
			}
			entry.ValidUntil = &now
			db.Updates(&entry)
			continue
		}
		existingFilenames[entry.Name] = true
	}

	log.Info("Found %d existing files", len(existingFilenames))

	var missingSegments []model.DataSegment
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
