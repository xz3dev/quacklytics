package model

import (
	"encoding/json"
	"github.com/google/uuid"
	"time"
)

type EventInput struct {
	EventType  string         `json:"eventType"`
	DistinctId string         `json:"distinctId"`
	Timestamp  time.Time      `json:"timestamp"`
	Properties map[string]any `json:"properties"`
}

type EventId struct {
	Id       uuid.UUID `json:"id"`
	PersonId uuid.UUID `json:"userId"`
}

type Event struct {
	EventId
	EventInput
}

func (e Event) MarshalJSON() ([]byte, error) {
	type Alias Event
	return json.Marshal(&struct {
		Timestamp int64 `json:"timestamp"`
		*Alias
	}{
		Timestamp: e.EventInput.Timestamp.UnixMilli(),
		Alias:     (*Alias)(&e),
	})
}
