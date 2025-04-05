package pipeline

import (
	"analytics/domain/person"
	"analytics/log"
)

type personUpdater struct {
	existingPersonsFn func() map[string]*person.Person
	PersonUpdates     map[string]*person.Person
}

func (p *personUpdater) Process(ctx *PipelineContext) error {
	p.PersonUpdates = make(map[string]*person.Person)

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

func (p *personUpdater) Name() string {
	return "PersonUpdater"
}
