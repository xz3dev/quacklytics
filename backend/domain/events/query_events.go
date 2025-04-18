package events

import (
	"analytics/database/analyticsdb"
	"analytics/domain/queries"
	"analytics/log"
	"database/sql"
	"encoding/json"
)

func QueryEvents(dbd *analyticsdb.DuckDBConnection, params *queries.QueryParams) (*[]EventWithPersonId, error) {
	if params == nil {
		params = &queries.EmptyQueryParams
	}
	tx, err := dbd.Tx()
	if err != nil {
		log.Error("Error while creating transaction: ", err)
		return nil, err
	}
	defer tx.Commit()

	query, args := queries.BuildSQL(params)

	log.Debug("Query: %s, args: %v", query, args)

	rows, err := tx.Query(query, args...)
	if err != nil {
		log.Error("Error executing query:", err)
		return nil, err
	}
	defer rows.Close()

	events, err := parseEvents(rows)
	if err != nil {
		log.Error("Error parsing events:", err)
		return nil, err
	}

	return events, nil
}

func parseEvents(rows *sql.Rows) (*[]EventWithPersonId, error) {
	var resultSet []EventWithPersonId
	for rows.Next() {
		var event EventWithPersonId
		var propertiesJson []byte
		if err := rows.Scan(
			&event.Id,
			&event.Timestamp,
			&event.EventType,
			&event.DistinctId,
			&event.PersonId,
			&propertiesJson,
		); err != nil {
			log.Error(err.Error(), err)
			return nil, err
		}
		if err := json.Unmarshal(propertiesJson, &event.Properties); err != nil {
			log.Error("Error unmarshalling properties:", err)
			return nil, err
		}
		resultSet = append(resultSet, event)
	}
	return &resultSet, nil
}
