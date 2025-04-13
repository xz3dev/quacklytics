package parquet

import (
	"analytics/config"
	"analytics/database/analyticsdb"
	"analytics/domain/filecatalog"
	"analytics/log"
	"analytics/util"
	"errors"
	"fmt"
	"gorm.io/gorm"
	"path"
	"time"
)

func ExportEventsToParquet(projectId string, db *gorm.DB, segment filecatalog.DataSegment) error {
	dbd, exists := analyticsdb.LookupTable[projectId]
	if !exists {
		return errors.New("project not found")
	}
	tx, err := dbd.Tx()
	if err != nil {
		return err
	}

	selectStmt := fmt.Sprintf(
		`
SELECT e.id, e.timestamp, e.event_type, e.distinct_id, p.person_id, e.properties 
FROM events e 
LEFT JOIN person_distinct_ids p ON p.distinct_id = e.distinct_id 
WHERE e.timestamp >= '%s' AND e.timestamp <= '%s'
`,
		segment.StartDate.Format(time.DateTime),
		segment.EndDate.Format(time.DateTime),
	)

	dir := path.Join(config.Config.Paths.Parquet, projectId)

	log.Debug(selectStmt)

	if err := util.EnsureDirectory(dir); err != nil {
		return err
	}

	filepath := path.Join(dir, segment.Filename)

	query := fmt.Sprintf(
		"COPY (%s) TO '%s' (FORMAT PARQUET, COMPRESSION 'zstd')",
		selectStmt,
		filepath,
	)
	resp, err := tx.Exec(query)
	if err != nil {
		return err
	}

	rows, err := resp.RowsAffected()
	if err != nil {
		return err
	}

	createCatalogEntry(
		projectId,
		db,
		segment,
		uint(rows),
	)

	if rows == 0 {
		log.Info("%v - %v: No events to export", segment.StartDate, segment.EndDate)
	} else {
		log.Info("%v - %v: Exported events to parquet: %d", segment.StartDate, segment.EndDate, rows)
	}

	return nil
}

func createCatalogEntry(
	projectId string,
	db *gorm.DB,
	segment filecatalog.DataSegment,
	count uint,
) error {
	filepath := path.Join(config.Config.Paths.Parquet, projectId, segment.Filename)
	checksum, err := util.CalculateFileChecksum(filepath)
	if err != nil {
		return err
	}

	entry := filecatalog.FileCatalogEntry{
		Name:       segment.Filename,
		Start:      &segment.StartDate,
		End:        &segment.EndDate,
		ValidUntil: segment.ValidUntil,
		Checksum:   checksum,
		EventCount: count,
	}

	return db.Create(&entry).Error
}
