package pipeline

import (
	"analytics/domain/events"
	"analytics/internal/log"
	"time"
)

type PipelineContext struct {
	InputEvents  []*events.EventInput
	OutputEvents []*events.Event
}

func newPipelineContext(input []*events.EventInput) *PipelineContext {
	return &PipelineContext{
		InputEvents:  input,
		OutputEvents: make([]*events.Event, 0, len(input)),
	}
}

// PipelineStep defines the interface for a processing step.
type PipelineStep interface {
	Process(ctx *PipelineContext) error
	Name() string
}

// pipeline is a collection of steps executed sequentially.
type pipeline struct {
	Steps []PipelineStep
}

// Process runs all the steps sequentially.
func (p *pipeline) Process(events []*events.EventInput) (*PipelineContext, error) {
	ctx := newPipelineContext(events)
	for _, step := range p.Steps {
		start := time.Now()
		stepName := step.Name()
		if err := step.Process(ctx); err != nil {
			return nil, err
		}
		elapsed := time.Since(start)

		log.Debug("Step %s took %v", stepName, elapsed.String())
	}
	return ctx, nil
}
