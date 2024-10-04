package model

import "time"

type EventInput struct {
	EventType  string         `json:"event_type"`
	UserId     string         `json:"user_id"`
	Timestamp  time.Time      `json:"timestamp"`
	Properties map[string]any `json:"properties"`
}

type eventId struct {
	Id string `json:"id"`
}

type Event struct {
	eventId
	EventInput
}
