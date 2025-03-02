package eventprocessor

import "analytics/model"

// EventProcessorInput holds the input events and any preexisting persons.
type Input struct {
	Events          []*model.EventInput
	ExistingPersons map[string]*model.Person
}

// EventProcessorOutput holds the final results from processing.
type Output struct {
	NewPersons     map[string]*model.Person
	UpdatedPersons map[string]*model.Person
	NewEvents      []*model.Event
}

// EventProcessor wraps the pipeline and exposes a simple interface.
type EventProcessor struct {
	Pipeline      *Pipeline
	PersonCreator *PersonCreator
	PersonUpdater *PersonUpdater
	Input         *Input
}

// NewEventProcessor instantiates the processor with the necessary stateful steps.
func NewEventProcessor(input *Input) *EventProcessor {
	personCreator := &PersonCreator{}
	personUpdater := &PersonUpdater{
		existingPersonsFn: func() map[string]*model.Person {
			allPersons := make(map[string]*model.Person)
			created := personCreator.CreatedPersons
			for k, v := range created {
				allPersons[k] = v
			}
			for k, v := range input.ExistingPersons {
				allPersons[k] = v
			}
			return allPersons
		},
	}

	// Build the pipeline with steps.
	pipeline := &Pipeline{
		Steps: []PipelineStep{
			&EventSorter{},
			&EventValidator{},
			&PersonPopulator{
				existingPersons: input.ExistingPersons,
			},
			personCreator,
			personUpdater,
			&EventVerifier{},
		},
	}

	return &EventProcessor{
		Pipeline:      pipeline,
		PersonCreator: personCreator,
		PersonUpdater: personUpdater,
		Input:         input,
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
		UpdatedPersons: e.PersonUpdater.PersonUpdates,
	}
	return output, nil
}
