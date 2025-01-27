package actions

import (
	"analytics/database/analyticsdb"
	"analytics/projects"
	"fmt"
	"log"
)

const ParquetDir = "pq"

func ExportToParquet(projectId string) error {
	tx, err := analyticsdb.Tx(projectId)
	if err != nil {
		return err
	}
	path := projects.TmpDir + "/" + ParquetDir
	query := fmt.Sprintf("COPY events TO '%s' (FORMAT PARQUET, COMPRESSION 'zstd', PARTITION_BY(event_type))", path)
	resp, err := tx.Exec(query)
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
