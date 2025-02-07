package filecatalog

import (
	"analytics/database/analyticsdb"
	"analytics/log"
	"analytics/projects"
	"analytics/util"
	"fmt"
	"time"

	"gorm.io/gorm"
)

func ExportEventsToParquet(projectId string, db *gorm.DB, segment DataSegment) error {
	tx, err := analyticsdb.Tx(projectId)
	if err != nil {
		return err
	}

	selectStmt := fmt.Sprintf(
		"SELECT * FROM events WHERE timestamp >= '%s' AND timestamp <= '%s'",
		segment.StartDate.Format(time.DateTime),
		segment.EndDate.Format(time.DateTime),
	)

	path := projects.TmpDir + "/" + projectId + "/" + ParquetDir + "/"

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

	CreateEntry(
		projectId,
		db,
		segment,
	)

	rows, err := resp.RowsAffected()
	if rows == 0 {
		println("No events to export")
	} else {
		log.Info("Exported events to parquet: %d", rows)
	}

	return nil
}

type exportParams struct {
	Start      *time.Time
	End        *time.Time
	ValidUntil *time.Time
}

func determineValidUntil(params *exportParams) {
	if params.ValidUntil != nil {
		return
	}

}
