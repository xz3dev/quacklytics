package events

import (
	"analytics/events/eventprocessor"
	"analytics/log"
	"analytics/model"
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

	e, err := p.newEventProcessor(events)
	if err != nil {
		log.Error("Error creating event processor: %v", err)
		return
	}
	result, err := e.Process()
	if err != nil {
		log.Error("Error processing events: %v", err)
		return
	}

	p.persistResult(result)

	duration := time.Since(startTime)
	log.Info("Project %s: Processed batch of %d events in %v", p.projectID, len(events), duration)
}

func (p *ProjectProcessor) persistResult(result *eventprocessor.Output) {
	p.createPersons(result.NewPersons, result.MappedPersons)
	p.updatePersons(result.UpdatedPersons)
	p.persistAllSchemas(result.Schema)
	p.persistEvents(result.NewEvents)
}

func (p *ProjectProcessor) newEventProcessor(events []*model.EventInput) (*eventprocessor.EventProcessor, error) {
	existingPersons, err := p.GetExistingPersons(events)
	if err != nil {
		return nil, err
	}
	uniqueEventTypes := extractUniqueEventTypes(events)
	schemas := FetchExistingSchemas(uniqueEventTypes, p.db)
	schemasByType := MakeSchemaMap(schemas)
	return eventprocessor.NewEventProcessor(&eventprocessor.Input{
		Events:          events,
		ExistingPersons: existingPersons,
		EventSchema:     schemasByType,
	}), nil
}

func mapUuid(id uuid.UUID) duckdb.UUID {
	var eventId duckdb.UUID
	copy(eventId[:], id[:])
	return eventId
}
