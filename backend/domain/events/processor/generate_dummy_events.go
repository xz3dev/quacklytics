package processor

import (
	"analytics/domain/events"
	"analytics/log"
	"fmt"
	"github.com/google/uuid"
	"math"
	"math/rand"
	"time"
)

func GenerateRandomEvents(projectId string, numEvents int, eventType string) {
	now := time.Now()
	rand.New(rand.NewSource(now.UnixNano()))

	// Calculate the start of 12 weeks ago
	twelveWeeksAgo := now.AddDate(0, 0, -12*7)

	// Calculate the total duration of 12 weeks in seconds
	totalDuration := now.Sub(twelveWeeksAgo).Seconds()

	log.Info("Generating %d events over the last 12 weeks", numEvents)

	for i := 0; i < numEvents; i++ {
		// Generate a random timestamp within the last 12 weeks
		randomSeconds := rand.Float64() * totalDuration
		timestamp := twelveWeeksAgo.Add(time.Duration(randomSeconds) * time.Second)

		randomProperties := map[string]any{}
		for j := 0; j < 10; j++ {
			if j%2 == 0 {
				factor := math.Sin(float64(i) / float64(numEvents))
				randomProperties[fmt.Sprintf("prop_%d", j)] = float64(rand.Intn(100)) * factor
			} else {
				randomProperties[fmt.Sprintf("prop_%d", j)] = uuid.New().String()
			}
		}

		eventInput := &events.EventInput{
			EventType:  eventType,
			DistinctId: uuid.New().String(),
			Timestamp:  timestamp,
			Properties: randomProperties,
		}

		ProcessEvent(projectId, eventInput)
	}
}
