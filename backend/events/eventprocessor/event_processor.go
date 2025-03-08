package eventprocessor

import (
	"analytics/model"
	"analytics/schema"
)

type Input struct {
	Events          []*model.EventInput
	ExistingPersons map[string]*model.Person
	EventSchema     map[string]*schema.EventSchema
}

type Output struct {
	NewPersons     map[string]*model.Person
	UpdatedPersons map[string]*model.Person
	MappedPersons  map[string]*model.Person
	Schema         map[string]*schema.EventSchema
	NewEvents      []*model.Event
}

type EventProcessor struct {
	Pipeline         *Pipeline
	PersonIdentifier *PersonIdentifier
	PersonCreator    *PersonCreator
	PersonUpdater    *PersonUpdater
	SchemaDiff       *SchemaDiff
	Input            *Input
}

func NewEventProcessor(input *Input) *EventProcessor {
	personIdentifier := &PersonIdentifier{
		existingPersons: input.ExistingPersons,
	}
	personCreator := &PersonCreator{
		existingPersons: input.ExistingPersons,
	}
	existingPersonsFn := func() map[string]*model.Person {
		allPersons := make(map[string]*model.Person)
		created := personCreator.CreatedPersons
		for k, v := range created {
			allPersons[k] = v
		}
		for k, v := range input.ExistingPersons {
			allPersons[k] = v
		}
		return allPersons

	}
	personUpdater := &PersonUpdater{
		existingPersonsFn: existingPersonsFn,
	}
	schemaDiff := &SchemaDiff{
		EventSchema: input.EventSchema,
	}

	// Build the pipeline with steps.
	pipeline := &Pipeline{
		Steps: []PipelineStep{
			&EventSorter{},
			&EventValidator{},
			schemaDiff,
			personIdentifier,
			personCreator,
			personUpdater,
		},
	}

	return &EventProcessor{
		Pipeline:         pipeline,
		PersonIdentifier: personIdentifier,
		PersonCreator:    personCreator,
		PersonUpdater:    personUpdater,
		SchemaDiff:       schemaDiff,
		Input:            input,
	}
}

func (e *EventProcessor) Process() (*Output, error) {
	ctx, err := e.Pipeline.Process(e.Input.Events)
	if err != nil {
		return nil, err
	}

	// Aggregate results from steps.
	output := &Output{
		NewEvents:      ctx.OutputEvents,
		NewPersons:     e.PersonCreator.CreatedPersons,
		MappedPersons:  e.PersonIdentifier.MappedPersons,
		UpdatedPersons: e.PersonUpdater.PersonUpdates,
		Schema:         e.SchemaDiff.EventSchema,
	}
	return output, nil
}
