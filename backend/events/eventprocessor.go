package events

import (
	"analytics/log"
	"analytics/model"
	"fmt"
	"github.com/google/uuid"
	"slices"
	"time"
)

// EventProcessor orchestrates the processing of events.
type EventProcessor struct {
	Input  EventProcessorInput
	Output EventProcessorOutput
	state  *EventProcessorState
}

// EventProcessorInput holds the incoming events and project context.
type EventProcessorInput struct {
	Events          []*model.EventInput
	ExistingPersons map[string]*model.Person
}

// EventProcessorOutput holds the resulting events and the changes to persons.
type EventProcessorOutput struct {
	NewPersons     map[string]*model.Person
	UpdatedPersons map[string]*model.Person
	NewEvents      []*model.Event
}

// EventProcessorState holds the unified cache of persons as well as markers
// for newly created and updated persons.
type EventProcessorState struct {
	persons        map[string]*model.Person // All persons processed (existing and new)
	newPersons     map[string]*model.Person // Persons created during this run
	updatedPersons map[string]*model.Person // Existing persons updated during this run
}

// newEventProcessorState initializes a new state.
func newEventProcessorState() *EventProcessorState {
	return &EventProcessorState{
		persons:        make(map[string]*model.Person),
		newPersons:     make(map[string]*model.Person),
		updatedPersons: make(map[string]*model.Person),
	}
}

// GetOrCreatePerson retrieves an existing person by distinctId or creates one if absent.
// It adds newly created persons to both the unified cache and the newPersons map.
func (s *EventProcessorState) GetOrCreatePerson(distinctId string, timestamp time.Time) *model.Person {
	if person, ok := s.persons[distinctId]; ok {
		return person
	}
	person := &model.Person{
		Id:         uuid.New(),
		FirstSeen:  timestamp,
		Properties: make(model.PersonProperties),
	}
	s.persons[distinctId] = person
	s.newPersons[distinctId] = person
	return person
}

// MarkUpdated records a person as updated (if not new).
func (s *EventProcessorState) MarkUpdated(distinctId string, person *model.Person) {
	// Only mark as updated if this person wasn't created in this run.
	if _, isNew := s.newPersons[distinctId]; !isNew {
		s.updatedPersons[distinctId] = person
	}
}

// Process runs the pipeline stages in order. If any stage fails, it returns an error.
func (e *EventProcessor) Process() error {
	// Initialize state and minimal output.
	e.state = newEventProcessorState()
	e.Output = EventProcessorOutput{
		NewEvents: make([]*model.Event, 0),
	}

	// Define the pipeline stages.
	stages := []func() error{
		e.sortEventsByTimeAsc,
		e.loadExistingPeople,
		e.dropInvalidEvents,
		e.populateResultArray,
		e.assignPeopleIdsToEvents,
		e.processPeopleProperties,
		e.verifyResults,
	}

	// Run each stage sequentially.
	for _, stage := range stages {
		if err := stage(); err != nil {
			return err
		}
	}

	// Populate final output from state.
	e.Output.NewPersons = e.state.newPersons
	e.Output.UpdatedPersons = e.state.updatedPersons

	return nil
}

// sortEventsByTimeAsc sorts the input events by timestamp in ascending order.
func (e *EventProcessor) sortEventsByTimeAsc() error {
	slices.SortFunc(e.Input.Events, func(i, j *model.EventInput) int {
		if i.Timestamp.Equal(j.Timestamp) {
			return 0
		}
		if i.Timestamp.Before(j.Timestamp) {
			return -1
		}
		return 1
	})
	return nil
}

// loadExistingPeople retrieves existing persons from the inputs and loads them into the state.
func (e *EventProcessor) loadExistingPeople() error {
	for k, v := range e.Input.ExistingPersons {
		e.state.persons[k] = v
	}
	return nil
}

// dropInvalidEvents filters out events that lack a valid DistinctId.
func (e *EventProcessor) dropInvalidEvents() error {
	validEvents := make([]*model.EventInput, 0, len(e.Input.Events))
	for _, event := range e.Input.Events {
		if event.DistinctId == "" {
			continue
		}
		validEvents = append(validEvents, event)
	}
	e.Input.Events = validEvents
	return nil
}

// populateResultArray creates event objects from the filtered event inputs.
func (e *EventProcessor) populateResultArray() error {
	e.Output.NewEvents = make([]*model.Event, 0, len(e.Input.Events))
	for _, event := range e.Input.Events {
		e.Output.NewEvents = append(e.Output.NewEvents, &model.Event{
			EventId: model.EventId{
				Id:       uuid.New(),
				PersonId: uuid.Nil,
			},
			EventInput: *event,
		})
	}
	return nil
}

// assignPeopleIdsToEvents assigns a person ID to each event using the unified state cache.
func (e *EventProcessor) assignPeopleIdsToEvents() error {
	for _, event := range e.Output.NewEvents {
		person := e.state.GetOrCreatePerson(event.DistinctId, event.Timestamp)
		event.PersonId = person.Id
	}
	return nil
}

// processPeopleProperties applies property updates from events to their associated persons.
// If any properties are updated, the person is marked as updated in the state.
func (e *EventProcessor) processPeopleProperties() error {
	for _, event := range e.Output.NewEvents {
		person, exists := e.state.persons[event.DistinctId]
		if !exists || person == nil {
			log.Error("Error processing people properties: person is nil")
			continue
		}

		updated := false
		if setProps, ok := event.Properties["$set"].(map[string]any); ok {
			person.Properties.ApplySetProps(setProps)
			updated = true
		}
		if setOnceProps, ok := event.Properties["$set_once"].(map[string]any); ok {
			person.Properties.ApplySetOnceProps(setOnceProps)
			updated = true
		}

		if updated {
			e.state.MarkUpdated(event.DistinctId, person)
		}
	}
	return nil
}

// verifyResults ensures that every processed event has been assigned a valid person ID.
func (e *EventProcessor) verifyResults() error {
	for _, event := range e.Output.NewEvents {
		if event.EventId.PersonId == uuid.Nil {
			return fmt.Errorf("new event %s has no personId", event.Timestamp.String())
		}
	}
	return nil
}
