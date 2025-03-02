package eventprocessor

import (
	"analytics/model"
)

type PipelineContext struct {
	InputEvents  []*model.EventInput
	OutputEvents []*model.Event
}

func newPipelineContext(events []*model.EventInput) *PipelineContext {
	return &PipelineContext{
		InputEvents:  events,
		OutputEvents: make([]*model.Event, 0, len(events)),
	}
}

// PipelineStep defines the interface for a processing step.
type PipelineStep interface {
	Process(ctx *PipelineContext) error
}

// Pipeline is a collection of steps executed sequentially.
type Pipeline struct {
	Steps []PipelineStep
}

// Process runs all the steps sequentially.
func (p *Pipeline) Process(events []*model.EventInput) (*PipelineContext, error) {
	ctx := newPipelineContext(events)
	for _, step := range p.Steps {
		if err := step.Process(ctx); err != nil {
			return nil, err
		}
	}
	return ctx, nil
}
