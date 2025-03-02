package events

import (
	"analytics/log"
	"analytics/model"
	"fmt"
	"github.com/google/uuid"
	"slices"
)

type EventProcessor struct {
	Input  EventProcessorInput
	Output EventProcessorOutput
	state  EventProcessorState
}

type EventProcessorInput struct {
	Events []*model.EventInput
	P      *ProjectProcessor
}

type EventProcessorOutput struct {
	NewPersons     map[string]*model.Person
	UpdatedPersons map[string]*model.Person
	NewEvents      []*model.Event
}

type EventProcessorState struct {
	knownPersons map[string]*model.Person // mapping distinctIds to persons
}

// Process initializes the state and then runs a series of pipeline stages.
// If any stage returns an error, the process stops and the error is returned.
func (e *EventProcessor) Process() error {
	// Initialize state and output
	e.state = EventProcessorState{
		knownPersons: make(map[string]*model.Person),
	}
	e.Output = EventProcessorOutput{
		NewPersons:     make(map[string]*model.Person),
		UpdatedPersons: make(map[string]*model.Person),
		NewEvents:      make([]*model.Event, 0),
	}

	// Define pipeline stages
	stages := []func() error{
		e.sortEventsByTimeAsc,
		e.loadExistingPeople,
		e.dropInvalidEvents,
		e.populateResultArray,
		e.assignPeopleIdsToEvents,
		e.processPeopleProperties,
		e.verifyResults,
	}

	// Run each stage sequentially
	for _, stage := range stages {
		if err := stage(); err != nil {
			return err
		}
	}
	return nil
}

// sort events so they are processed in the right order.
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

// loadExistingPeople retrieves existing persons and loads them into state.
func (e *EventProcessor) loadExistingPeople() error {
	existingPersons, err := getExistingPersons(e.Input.P, e.Input.Events)
	if err != nil {
		return err
	}
	for k, v := range existingPersons {
		e.state.knownPersons[k] = v
	}
	return nil
}

// dropInvalidEvents filters out events with an empty DistinctId.
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

// populateResultArray creates new event objects from the filtered events.
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

// determinePerson checks for an existing person by distinctId.
func (e *EventProcessor) determinePerson(distinctId string) (*model.Person, bool) {
	if person, ok := e.state.knownPersons[distinctId]; ok {
		return person, true
	}
	if person, ok := e.Output.NewPersons[distinctId]; ok {
		return person, true
	}
	return nil, false
}

// createNewPersonForEventAndAssignPersonId creates a new person and assigns its id to the event.
func (e *EventProcessor) createNewPersonForEventAndAssignPersonId(event *model.Event) {
	person := &model.Person{
		Id:         uuid.New(),
		FirstSeen:  event.Timestamp,
		Properties: make(model.PersonProperties),
	}
	e.Output.NewPersons[event.DistinctId] = person
	event.PersonId = person.Id
}

// assignPeopleIdsToEvents assigns a person ID to each event by either using an existing person
// or creating a new one.
func (e *EventProcessor) assignPeopleIdsToEvents() error {
	for _, event := range e.Output.NewEvents {
		if person, exists := e.determinePerson(event.DistinctId); exists {
			event.PersonId = person.Id
		} else {
			e.createNewPersonForEventAndAssignPersonId(event)
		}
	}
	return nil
}

// processPeopleProperties applies property changes to persons based on event properties.
func (e *EventProcessor) processPeopleProperties() error {
	for _, event := range e.Output.NewEvents {
		var person *model.Person
		// Check if the person was updated already
		person, personExists := e.Output.UpdatedPersons[event.DistinctId]
		// Otherwise, look in the known persons list
		if !personExists {
			person, personExists = e.state.knownPersons[event.DistinctId]
		}
		// Otherwise, use the new persons created
		if !personExists {
			person = e.Output.NewPersons[event.DistinctId]
		}
		if person == nil {
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

		if personExists && updated {
			e.Output.UpdatedPersons[event.DistinctId] = person
		}
	}
	return nil
}

// verifyResults ensures that all new events have a valid person ID.
func (e *EventProcessor) verifyResults() error {
	for _, event := range e.Output.NewEvents {
		if event.EventId.PersonId == uuid.Nil {
			return fmt.Errorf("new event %s has no personId", event.Timestamp.String())
		}
	}
	return nil
}
