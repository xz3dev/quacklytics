package actions

import (
	"analytics/database/analyticsdb"
	"analytics/log"
	"analytics/projects"
	"analytics/util"
	"fmt"
	"gorm.io/gorm"
)

const ParquetDir = "pq"

func ExportToParquet(projectId string, db *gorm.DB) error {
	tx, err := analyticsdb.Tx(projectId)
	if err != nil {
		return err
	}

	settings, err := projects.QuerySettings(db)

	partitionBy := settings[projects.Partition]
	fileName := ""
	var partitionSql string
	var selectStmt string
	if len(partitionBy) > 0 {
		partitionSql = ", PARTITION_BY(partition)"
		selectStmt = fmt.Sprintf("SELECT *, %s as partition FROM events", partitionBy)
	} else {
		partitionSql = ""
		fileName = "events.parquet"
	}

	path := projects.TmpDir + "/" + projectId + "/" + ParquetDir + "/"

	if err := util.ClearDirectory(path); err != nil {
		return err
	}

	query := fmt.Sprintf(
		"COPY (%s) TO '%s%s' (FORMAT PARQUET, COMPRESSION 'zstd' %s)",
		selectStmt,
		path,
		fileName,
		partitionSql,
	)
	resp, err := tx.Exec(query)
	if err != nil {
		return err
	}

	rows, err := resp.RowsAffected()
	if rows == 0 {
		println("No events to export")
	} else {
		log.Info("Exported events to parquet: %d", rows)
	}

	return nil
}
