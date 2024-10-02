package model

import "time"

type Event struct {
	Id         string         `json:"id"`
	EventType  string         `json:"event_type"`
	UserId     string         `json:"user_id"`
	Timestamp  time.Time      `json:"timestamp"`
	Properties map[string]any `json:"properties"`
}
