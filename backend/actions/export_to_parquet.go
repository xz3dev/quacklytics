package actions

import (
	"analytics/database/analyticsdb"
	"analytics/projects"
	"log"
)

const ParquetDir = "pq"

func ExportToParquet(projectId string) error {
	tx, err := analyticsdb.Tx(projectId)
	if err != nil {
		return err
	}
	path := projects.TmpDir + "/" + ParquetDir
	resp, err := tx.Exec(" COPY events TO 'output.parquet' (FORMAT PARQUET, COMPRESSION 'zstd', PARTITION_BY(event_type)); ")
	if err != nil {
		return err
	}

	rows, err := resp.RowsAffected()
	if rows == 0 {
		println("No events to export")
	} else {
		log.Printf("Exported events to parquet: %d", rows)
	}

	return nil
}
