package actions

import (
	"analytics/database"
	"analytics/model"
	"github.com/goccy/go-json"
	"github.com/google/uuid"
	"github.com/marcboeker/go-duckdb"
	"log"
	"time"
)

func ProcessEvent(event *model.EventInput) {
	appender := database.Appender("events")
	defer appender.Close()
	eventId := generateEventId()

	propertiesJson, err := json.Marshal(event.Properties)
	if err != nil {
		log.Println(err)
		return
	}
	err = appender.AppendRow(
		eventId,
		time.Now(),
		event.EventType,
		event.UserId,
		propertiesJson,
	)
	if err != nil {
		log.Println(err)
		return
	}
	err = appender.Flush()
	if err != nil {
		log.Println(err)
		return
	}
	log.Printf("Processing event %s from %s", eventId, event.Timestamp)
}

func generateEventId() duckdb.UUID {
	bytes, err := uuid.New().MarshalText()
	if err != nil {
		log.Println(err)
		return duckdb.UUID{}
	}
	var eventId duckdb.UUID
	copy(eventId[:], bytes)
	return eventId
}
