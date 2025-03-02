package events

import (
	"analytics/log"
	"analytics/model"
	"fmt"
	"github.com/google/uuid"
)

type EventProcessor struct {
	Input  EventProcessorInput
	Output EventProcessorOutput
	state  EventProcessorState
	Error  error
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
	knownPersons map[string]*model.Person // mapping distinctIds to personIds
}

func (e *EventProcessor) Process() {
	defer func() {
		if r := recover(); r != nil {
			e.Error = r.(error)
		}
	}()

	e.state = EventProcessorState{
		knownPersons: make(map[string]*model.Person),
	}

	e.Output = EventProcessorOutput{
		NewPersons:     make(map[string]*model.Person),
		UpdatedPersons: make(map[string]*model.Person),
		NewEvents:      make([]*model.Event, 0),
	}

	e.loadExistingPeople()
	e.dropInvalidEvents()
	e.populateResultArray()
	e.assignPeopleIdsToEvents()
	e.processPeopleProperties()
	e.verifyResults()
}

func (e *EventProcessor) loadExistingPeople() {
	existingPersons, err := getExistingPersons(e.Input.P, e.Input.Events)
	panicNN(err)

	for k, v := range existingPersons {
		e.state.knownPersons[k] = v
	}
}

func (e *EventProcessor) dropInvalidEvents() {
	var newSlice []*model.EventInput
	for _, event := range e.Input.Events {
		if event.DistinctId == "" {
			continue
		}
		newSlice = append(newSlice, event)
	}
	e.Input.Events = newSlice
}

func (e *EventProcessor) populateResultArray() {
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
}

func (e *EventProcessor) determinePerson(distinctId string) (*model.Person, bool) {
	existing, doesExist := e.state.knownPersons[distinctId]
	if doesExist {
		return existing, true
	}
	existing, doesExist = e.Output.NewPersons[distinctId]
	return existing, doesExist
}

func (e *EventProcessor) createNewPersonForEventAndAssignPersonId(event *model.Event) {
	person := &model.Person{
		Id:         uuid.New(),
		FirstSeen:  event.Timestamp,
		Properties: make(model.PersonProperties),
	}
	e.Output.NewPersons[event.DistinctId] = person
	event.PersonId = person.Id
}

func (e *EventProcessor) assignPeopleIdsToEvents() {
	for _, event := range e.Output.NewEvents {
		existing, doesExist := e.determinePerson(event.DistinctId)
		if doesExist {
			event.PersonId = existing.Id
		} else {
			e.createNewPersonForEventAndAssignPersonId(event)
		}
	}
}

func (e *EventProcessor) verifyResults() {
	for _, e := range e.Output.NewEvents {
		if e.EventId.PersonId == uuid.Nil {
			panic(fmt.Sprintf("New event %s has no personId", e.Timestamp.String()))
		}
	}
}

func (e *EventProcessor) processPeopleProperties() {
	for _, event := range e.Output.NewEvents {
		var person *model.Person
		person, personExists := e.Output.UpdatedPersons[event.DistinctId]
		if !personExists {
			person, personExists = e.state.knownPersons[event.DistinctId]
		}
		if !personExists {
			person = e.Output.NewPersons[event.DistinctId]
		}
		if person == nil {
			// error here ?
			log.Error("Error processing people properties: person is nil")
			continue
		}

		setProps := event.Properties["$set"]
		setOnceProps := event.Properties["$set_once"]

		setPropsSafe, ok := setProps.(map[string]any)
		updated := false
		if ok {
			person.Properties.ApplySetProps(setPropsSafe)
			updated = true
		}
		setOncePropsSafe, ok := setOnceProps.(map[string]any)
		if ok {
			person.Properties.ApplySetOnceProps(setOncePropsSafe)
			updated = true
		}

		if personExists && updated {
			e.Output.UpdatedPersons[event.DistinctId] = person
		}
	}
}

func panicNN(err error) {
	if err != nil {
		panic(err)
	}
}
