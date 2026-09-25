package events

import (
	"encoding/json"
	"github.com/google/uuid"
	"time"
)

type EventInput struct {
	EventType        string         `json:"eventType"`
	SessionId        *string        `json:"sessionId,omitempty"`
	PersonId         *string        `json:"personId,omitempty"`
	Timestamp        time.Time      `json:"timestamp"`
	Properties       map[string]any `json:"properties,omitempty"`
	PersonProperties map[string]any `json:"personProperties,omitempty"`
}

type EventId struct {
	Id uuid.UUID `json:"id"`
}

type Event struct {
	EventId
	EventInput
}

type EventOutput struct {
	EventId
	EventType  string         `json:"eventType"`
	SessionId  *string        `json:"sessionId,omitempty"`
	PersonId   *string        `json:"personId,omitempty"`
	Timestamp  time.Time      `json:"timestamp"`
	Properties map[string]any `json:"properties"`
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
