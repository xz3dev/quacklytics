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

func GenerateParquetFiles(projectId string, db *gorm.DB) {
	now := time.Now()
	cutoff := now.AddDate(-2, 0, 0)
	segments := filecatalog.GenerateTimeFragments(now, cutoff)

	filenames := make([]string, len(segments))
	for i, segment := range segments {
		filenames[i] = segment.Filename
	}

	existing, err := filecatalog.ListAll(db)
	if err != nil {
		log.Error("FileGen %s: Could not list existing files: %s", projectId, err)
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

	log.Info("FileGen %s: Found %d existing files", projectId, len(existingFilenames))

	var missingSegments []model.DataSegment
	for _, segment := range segments {
		if !existingFilenames[segment.Filename] {
			missingSegments = append(missingSegments, segment)
		}
	}

	log.Info("FileGen %s: Found %d missing files", projectId, len(missingSegments))

	for _, segment := range missingSegments {
		err := ExportEventsToParquet(projectId, db, segment)
		if err != nil {
			log.Error("FileGen %s: Could not export segment %s: %s", projectId, segment.Filename, err)
		}
	}
}
