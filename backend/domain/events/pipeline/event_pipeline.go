package pipeline

import (
	"analytics/domain/events"
	"analytics/model"
	"analytics/schema"
)

type Input struct {
	Events          []*events.EventInput
	ExistingPersons map[string]*model.Person
	EventSchema     map[string]*schema.EventSchema
}

type Output struct {
	NewPersons     map[string]*model.Person
	UpdatedPersons map[string]*model.Person
	MappedPersons  map[string]*model.Person
	Schema         map[string]*schema.EventSchema
	NewEvents      []*events.Event
}

type EventPipeline struct {
	Pipeline         *pipeline
	PersonIdentifier *personIdentifier
	PersonCreator    *personCreator
	PersonUpdater    *personUpdater
	SchemaDiff       *schemaDiff
	Input            *Input
}

func New(input *Input) *EventPipeline {
	personIdentifier := &personIdentifier{
		existingPersons: input.ExistingPersons,
	}
	personCreator := &personCreator{
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
	personUpdater := &personUpdater{
		existingPersonsFn: existingPersonsFn,
	}
	schemaDiff := &schemaDiff{
		EventSchema: input.EventSchema,
	}

	// Build the pipeline with steps.
	pipeline := &pipeline{
		Steps: []PipelineStep{
			&EventSorter{},
			&EventValidator{},
			schemaDiff,
			personIdentifier,
			personCreator,
			personUpdater,
		},
	}

	return &EventPipeline{
		Pipeline:         pipeline,
		PersonIdentifier: personIdentifier,
		PersonCreator:    personCreator,
		PersonUpdater:    personUpdater,
		SchemaDiff:       schemaDiff,
		Input:            input,
	}
}

func (e *EventPipeline) Process() (*Output, error) {
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
