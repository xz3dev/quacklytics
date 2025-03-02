package eventprocessor

import (
	"analytics/log"
	"analytics/model"
)

type PersonUpdater struct {
	existingPersonsFn func() map[string]*model.Person
	PersonUpdates     map[string]*model.Person
}

func (p *PersonUpdater) Process(ctx *PipelineContext) error {
	p.PersonUpdates = make(map[string]*model.Person)

	existingPersons := p.existingPersonsFn()

	for _, event := range ctx.OutputEvents {
		person, exists := p.PersonUpdates[event.DistinctId]
		if !exists {
			person, exists = existingPersons[event.DistinctId]
		}
		if !exists {
			log.Error("Error processing people properties: person is nil, but should exist.")
			continue
		}

		updated := false
		if setProps, ok := event.Properties["$set"].(map[string]any); ok {
			person.Properties.ApplySetProps(setProps)
			updated = len(setProps) > 0
		}
		if setOnceProps, ok := event.Properties["$set_once"].(map[string]any); ok {
			person.Properties.ApplySetOnceProps(setOnceProps)
			updated = updated || len(setOnceProps) > 0
		}

		if updated {
			p.PersonUpdates[event.DistinctId] = person
		}
	}
	return nil
}
