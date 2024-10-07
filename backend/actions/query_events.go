package actions

import (
	"analytics/database"
	"analytics/model"
	"analytics/queries"
	"database/sql"
	"encoding/json"
	"log"
)

func QueryEvents(params *queries.QueryParams) (*[]model.Event, error) {
	if params == nil {
		params = &queries.EmptyQueryParams
	}

	tx, err := database.Tx()
	if err != nil {
		log.Println("Error while creating transaction: ", err)
		return nil, err
	}
	defer tx.Commit()

	query, args := queries.BuildSQL(params)

	log.Printf("Query: %s, args: %v", query, args)

	rows, err := tx.Query(query, args...)
	if err != nil {
		log.Println("Error executing query:", err)
		return nil, err
	}
	defer rows.Close()

	events, err := parseEvents(rows)
	if err != nil {
		log.Println("Error parsing events:", err)
		return nil, err
	}

	return events, nil
}

func parseEvents(rows *sql.Rows) (*[]model.Event, error) {
	var events []model.Event
	for rows.Next() {
		var event model.Event
		var propertiesJson []byte
		if err := rows.Scan(
			&event.Id,
			&event.Timestamp,
			&event.EventType,
			&event.UserId,
			&propertiesJson,
		); err != nil {
			log.Println(err)
			return nil, err
		}
		if err := json.Unmarshal(propertiesJson, &event.Properties); err != nil {
			log.Println("Error unmarshalling properties:", err)
			return nil, err
		}
		events = append(events, event)
	}
	return &events, nil
}
