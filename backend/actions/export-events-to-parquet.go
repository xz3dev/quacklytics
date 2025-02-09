package actions

import (
	"analytics/constants"
	"analytics/database/analyticsdb"
	"analytics/log"
	"analytics/model"
	"analytics/util"
	"fmt"
	"gorm.io/gorm"
	"time"
)

func ExportEventsToParquet(projectId string, db *gorm.DB, segment model.DataSegment) error {
	tx, err := analyticsdb.Tx(projectId)
	if err != nil {
		return err
	}

	selectStmt := fmt.Sprintf(
		"SELECT * FROM events WHERE timestamp >= '%s' AND timestamp <= '%s'",
		segment.StartDate.Format(time.DateTime),
		segment.EndDate.Format(time.DateTime),
	)

	path := constants.TmpDir + "/" + projectId + "/" + constants.ParquetDir + "/"

	if err := util.EnsureDirectory(path); err != nil {
		return err
	}

	query := fmt.Sprintf(
		"COPY (%s) TO '%s%s' (FORMAT PARQUET, COMPRESSION 'zstd')",
		selectStmt,
		path,
		segment.Filename,
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
		println("No events to export")
	} else {
		log.Info("Exported events to parquet: %d", rows)
	}

	return nil
}

func createCatalogEntry(
	projectId string,
	db *gorm.DB,
	segment model.DataSegment,
	count uint,
) error {
	filepath := constants.TmpDir + "/" + projectId + "/" + constants.ParquetDir + "/" + segment.Filename
	checksum, err := util.CalculateFileChecksum(filepath)
	if err != nil {
		return err
	}

	entry := model.FileCatalogEntry{
		Name:       segment.Filename,
		Start:      &segment.StartDate,
		End:        &segment.EndDate,
		ValidUntil: segment.ValidUntil,
		Checksum:   checksum,
		EventCount: count,
	}

	return db.Create(&entry).Error
}
