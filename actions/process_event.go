package actions

import (
	"analytics/model"
	"log"
)

func ProcessEvent(event *model.Event) {
	log.Printf("Processing event %s at %s", event.EventType, event.Timestamp)
}
