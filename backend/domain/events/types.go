package events

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
	Id uuid.UUID `json:"id"`
}

type Event struct {
	EventId
	EventInput
}

type EventWithPersonId struct {
	EventId
	EventInput
	PersonId uuid.UUID `json:"personId"`
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
