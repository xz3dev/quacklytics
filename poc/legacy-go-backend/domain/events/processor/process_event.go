package processor

import (
	"analytics/domain/events"
	"analytics/domain/schema"
	"analytics/log"
	"github.com/duckdb/duckdb-go/v2"
	"github.com/google/uuid"
	"slices"
	"time"
)

const (
	batchSize    = 100
	batchTimeout = 5 * time.Second
)

func ProcessEvent(projectID string, event *events.EventInput) {
	processor := GetOrCreateProcessor(projectID)
	processor.eventQueue <- event
}

func ProcessEvents(projectID string, events []*events.EventInput) {
	processor := GetOrCreateProcessor(projectID)
	for _, event := range events {
		processor.eventQueue <- event
	}
}

// actions/process_event.go
func (p *ProjectProcessor) processEventQueue() {
	batch := make([]*events.EventInput, 0, batchSize)
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

func (p *ProjectProcessor) processBatch(input []*events.EventInput) {
	log.Info("Project %s: Processing batch of %d events", p.projectID, len(input))
	startTime := time.Now()

	workingCopy := make([]*events.EventInput, 0, len(input))
	for i, event := range input {
		normalized := normalizeEvent(event)
		if normalized == nil {
			continue
		}
		workingCopy = append(workingCopy, normalized)
		input[i] = normalized
	}

	if len(workingCopy) == 0 {
		log.Info("Project %s: No valid events in batch", p.projectID)
		return
	}

	slices.SortFunc(workingCopy, func(i, j *events.EventInput) int {
		if i.Timestamp.Equal(j.Timestamp) {
			return 0
		}
		isBefore := i.Timestamp.Before(j.Timestamp)
		if isBefore {
			return -1
		}
		return 1
	})

	uniqueEventTypes := schema.ExtractUniqueEventTypes(workingCopy)
	schemas := schema.FetchExistingSchemas(uniqueEventTypes, p.db)
	schemasByType := schema.MakeSchemaMap(schemas)
	mergeEventsIntoSchemas(workingCopy, schemasByType)

	newEvents := make([]*events.Event, 0, len(workingCopy))
	for _, event := range workingCopy {
		newEvents = append(newEvents, &events.Event{
			EventId: events.EventId{
				Id: uuid.New(),
			},
			EventInput: *event,
		})
	}

	if err := p.ProcessIdentities(newEvents); err != nil {
		log.Error("Error processing identities: %v", err)
		return
	}

	p.PersistAllSchemas(schemasByType)
	p.PersistEvents(newEvents)

	duration := time.Since(startTime)
	log.Info("Project %s: Processed batch of %d events in %v", p.projectID, len(workingCopy), duration)
}

func mapUuid(id uuid.UUID) duckdb.UUID {
	var eventId duckdb.UUID
	copy(eventId[:], id[:])
	return eventId
}

func normalizeEvent(event *events.EventInput) *events.EventInput {
	if event == nil || event.EventType == "" {
		return nil
	}
	if event.Timestamp.IsZero() {
		event.Timestamp = time.Now().UTC()
	}
	if event.Properties == nil {
		event.Properties = make(map[string]any)
	}
	if event.PersonProperties == nil {
		event.PersonProperties = make(map[string]any)
	}
	return event
}
