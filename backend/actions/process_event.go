package actions

import (
	"analytics/database"
	"analytics/model"
	"github.com/goccy/go-json"
	"github.com/google/uuid"
	"github.com/marcboeker/go-duckdb"
	"log"
	"sync"
	"time"
)

const (
	batchSize    = 100
	batchTimeout = 30 * time.Second
)

var (
	eventQueue   = make(chan *model.EventInput, 1000)
	batchProcess sync.Once
)

func init() {
	go processEventQueue()
}

func ProcessEvent(event *model.EventInput) {
	eventQueue <- event
}

func processEventQueue() {
	batch := make([]*model.EventInput, 0, batchSize)
	timer := time.NewTimer(batchTimeout)

	for {
		select {
		case event := <-eventQueue:
			batch = append(batch, event)
			if len(batch) >= batchSize {
				log.Println("Batch size limit reached, processing batch")
				processBatch(batch)
				batch = batch[:0] // Reset batch
				timer.Reset(batchTimeout)
			}

		case <-timer.C:
			log.Println("Batch timeout reached, processing batch")
			if len(batch) > 0 {
				processBatch(batch)
				batch = batch[:0]
			}
			timer.Reset(batchTimeout)
		}
	}
}

func processBatch(events []*model.EventInput) {
	startTime := time.Now() // Start timing
	appender := database.Appender("events")
	defer appender.Flush()
	defer appender.Close()

	for _, event := range events {
		propertiesJson, err := json.Marshal(event.Properties)
		if err != nil {
			log.Println(err)
			continue
		}
		err = appender.AppendRow(
			mapUuid(uuid.New()),
			event.Timestamp,
			event.EventType,
			mapUuid(event.UserId),
			propertiesJson,
		)
		if err != nil {
			log.Println(err)
			continue
		}
	}

	if err := appender.Close(); err != nil {
		log.Println(err)
		return
	}
	endTime := time.Now() // End timing
	duration := endTime.Sub(startTime)

	log.Printf("Processed batch of %d events in %v", len(events), duration)
}

func mapUuid(id uuid.UUID) duckdb.UUID {
	var eventId duckdb.UUID
	copy(eventId[:], id[:])
	return eventId
}
