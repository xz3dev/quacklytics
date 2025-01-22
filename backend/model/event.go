package model

import (
	"github.com/google/uuid"
	"time"
)

type EventInput struct {
	EventType  string         `json:"eventType"`
	PersonId   uuid.UUID      `json:"userId"`
	DistinctId string         `json:"distinctId"`
	Timestamp  time.Time      `json:"timestamp"`
	Properties map[string]any `json:"properties"`
}

type eventId struct {
	Id uuid.UUID `json:"id"`
}

type Event struct {
	eventId
	EventInput
}
