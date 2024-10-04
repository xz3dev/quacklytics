package actions

import (
	"analytics/model"
	"log"
	"math/rand"
	"time"
)

func GenerateRandomEvents(numEvents int, eventType string) {
	now := time.Now()
	rand.New(rand.NewSource(now.UnixNano()))

	timestep := 4 * 7 * 24 * 60 * time.Second // Generate a random timestep between 4 and 8 weeks
	log.Printf("Generating %d events with timestep of %v", numEvents, timestep)
	for i := 0; i < numEvents; i++ {
		// Generate a random timestamp within the last 4 weeks
		timestamp := now.Add(-(timestep * time.Duration(i)))

		// Create fluctuating properties
		properties := map[string]any{
			"value": float64(rand.Intn(100)), // Example fluctuating property
			"flag":  rand.Intn(2) == 1,
		}

		eventInput := &model.EventInput{
			EventType:  eventType,
			UserId:     "user_" + string(rand.Intn(1000)), // Example user ID
			Timestamp:  timestamp,
			Properties: properties,
		}

		ProcessEvent(eventInput)
	}
}
