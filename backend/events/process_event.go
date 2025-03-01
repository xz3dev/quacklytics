package events

import (
	"analytics/log"
	"analytics/model"
	"encoding/json"
	"github.com/google/uuid"
	"github.com/marcboeker/go-duckdb"
	"slices"
	"time"
)

const (
	batchSize    = 100
	batchTimeout = 5 * time.Second
)

func ProcessEvent(projectID string, event *model.EventInput) {
	processor := GetOrCreateProcessor(projectID)
	processor.eventQueue <- event
}

func ProcessEvents(projectID string, events []*model.EventInput) {
	processor := GetOrCreateProcessor(projectID)
	for _, event := range events {
		processor.eventQueue <- event
	}
}

// actions/process_event.go
func (p *ProjectProcessor) processEventQueue() {
	batch := make([]*model.EventInput, 0, batchSize)
	timer := time.NewTimer(batchTimeout)

	for {
		select {
		case event := <-p.eventQueue:
			batch = append(batch, event)
			if len(batch) >= batchSize {
				p.processBatch(batch)
				batch = batch[:0]
				timer.Reset(batchTimeout)
			}

		case <-timer.C:
			if len(batch) > 0 {
				p.processBatch(batch)
				batch = batch[:0]
			}
			timer.Reset(batchTimeout)
		}
	}
}

func (p *ProjectProcessor) processBatch(input []*model.EventInput) {
	startTime := time.Now()

	events := make([]*model.EventInput, len(input))
	for i, event := range input {
		events[i] = event
	}

	slices.SortFunc(events, func(i, j *model.EventInput) int {
		if i.Timestamp.Equal(j.Timestamp) {
			return 0
		}
		isBefore := i.Timestamp.Before(j.Timestamp)
		if isBefore {
			return -1
		}
		return 1
	})

	// Pass project-specific DB to schema inference
	ApplySchemaChanges(events, p.db)

	p.ProcessPeopleDataBatch(events)

	appender := p.dbd.Appender("events")
	defer appender.Close()

	for _, event := range events {
		propertiesJson, err := json.Marshal(event.Properties)
		if err != nil {
			log.Error("Project %s: Error marshaling properties: %v", p.projectID, err)
			continue
		}

		err = appender.AppendRow(
			mapUuid(uuid.New()),
			event.Timestamp,
			event.EventType,
			event.DistinctId,
			mapUuid(uuid.New()), // todo
			propertiesJson,
		)
		if err != nil {
			log.Error("Project %s: Error appending row: %v", p.projectID, err)
			continue
		}
	}

	duration := time.Since(startTime)
	log.Info("Project %s: Processed batch of %d events in %v", p.projectID, len(events), duration)
}

func mapUuid(id uuid.UUID) duckdb.UUID {
	var eventId duckdb.UUID
	copy(eventId[:], id[:])
	return eventId
}
