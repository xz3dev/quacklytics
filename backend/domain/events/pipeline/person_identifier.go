package pipeline

import (
	"analytics/domain/person"
)

type personIdentifier struct {
	existingPersons map[string]*person.Person
	MappedPersons   map[string]*person.Person
}

func (p *personIdentifier) Process(ctx *PipelineContext) error {
	p.MappedPersons = make(map[string]*person.Person)
	for _, event := range ctx.InputEvents {
		if event.EventType == "$identify" {
			oldDistinctId, ok := event.Properties["$anon_distinct_id"].(string)
			if !ok {
				continue
			}
			existingPerson, ok := p.existingPersons[oldDistinctId]
			if !ok {
				continue
			}
			p.MappedPersons[oldDistinctId] = existingPerson
		}
	}
	return nil
}

func (p *personIdentifier) Name() string {
	return "PersonIdentifier"
}
