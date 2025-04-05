package pipeline

import (
	"analytics/domain/events"
	"github.com/google/uuid"
)

type EventValidator struct{}

func (v *EventValidator) Process(ctx *PipelineContext) error {
	valid := make([]*events.Event, 0, len(ctx.InputEvents))
	for _, event := range ctx.InputEvents {
		if event.DistinctId != "" {
			valid = append(valid, &events.Event{
				EventInput: *event,
				EventId: events.EventId{
					Id: uuid.New(),
				},
			})
		}
	}
	ctx.OutputEvents = valid
	return nil
}

func (s *EventValidator) Name() string {
	return "EventValidator"
}
