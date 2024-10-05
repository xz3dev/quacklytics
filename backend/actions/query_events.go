package actions

import (
	"analytics/database"
	"analytics/model"
	"database/sql"
	"encoding/json"
	"log"
)

func QueryEvents() (*[]model.Event, error) {
	tx, err := database.Tx()
	defer tx.Commit()
	if err != nil {
		log.Println("Error while creating transaction: ", err)
		return nil, err
	}
	rows, err := tx.Query("select * from events")
	if err != nil {
		log.Println(err)
		return nil, err
	}
	defer rows.Close()
	events, err := parseEvent(rows)
	if err != nil {
		log.Println(err)
		return nil, err
	}

	return events, nil
}

func parseEvent(rows *sql.Rows) (*[]model.Event, error) {
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
			log.Println(err)
			return nil, err
		}
		events = append(events, event)
	}
	return &events, nil
}
