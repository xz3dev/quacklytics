package pipeline

import (
	"analytics/domain/events"
	"slices"
)

type EventSorter struct{}

func (s *EventSorter) Process(ctx *PipelineContext) error {
	slices.SortFunc(ctx.InputEvents, func(a, b *events.EventInput) int {
		if a.Timestamp.Equal(b.Timestamp) {
			return 0
		}
		if a.Timestamp.Before(b.Timestamp) {
			return -1
		}
		return 1
	})
	return nil
}

func (s *EventSorter) Name() string {
	return "EventSorter"
}
