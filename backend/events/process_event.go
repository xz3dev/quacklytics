package events

import (
	"analytics/database/analyticsdb"
	"analytics/database/appdb"
	"analytics/model"
	"encoding/json"
	"github.com/google/uuid"
	"github.com/marcboeker/go-duckdb"
	"log"
	"slices"
	"time"
)

const (
	batchSize    = 100
	batchTimeout = 30 * time.Second
)

func ProcessEvent(projectID string, event *model.EventInput) {
	db, exists := appdb.ProjectDBs[projectID]
	if !exists {
		log.Printf("No database found for project: %s", projectID)
		return
	}

	processor := GetOrCreateProcessor(projectID, db)
	processor.eventQueue <- event
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

	appender := analyticsdb.Appender(p.projectID, "events")
	defer appender.Close()

	for _, event := range events {
		propertiesJson, err := json.Marshal(event.Properties)
		if err != nil {
			log.Printf("Project %s: Error marshaling properties: %v", p.projectID, err)
			continue
		}

		err = appender.AppendRow(
			mapUuid(uuid.New()),
			event.Timestamp,
			event.EventType,
			event.DistinctId,
			mapUuid(event.PersonId),
			propertiesJson,
		)
		if err != nil {
			log.Printf("Project %s: Error appending row: %v", p.projectID, err)
			continue
		}
	}

	duration := time.Since(startTime)
	log.Printf("Project %s: Processed batch of %d events in %v", p.projectID, len(events), duration)
}

func mapUuid(id uuid.UUID) duckdb.UUID {
	var eventId duckdb.UUID
	copy(eventId[:], id[:])
	return eventId
}
