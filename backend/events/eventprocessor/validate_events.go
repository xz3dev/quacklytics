package eventprocessor

import (
	"analytics/model"
	"github.com/google/uuid"
)

type EventValidator struct{}

func (v *EventValidator) Process(ctx *PipelineContext) error {
	valid := make([]*model.Event, 0, len(ctx.InputEvents))
	for _, event := range ctx.InputEvents {
		if event.DistinctId != "" {
			valid = append(valid, &model.Event{
				EventInput: *event,
				EventId: model.EventId{
					Id: uuid.New(),
				},
			})
		}
	}
	ctx.OutputEvents = valid
	return nil
}
