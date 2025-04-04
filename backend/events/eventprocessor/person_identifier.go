package eventprocessor

import (
	"analytics/model"
)

type PersonIdentifier struct {
	existingPersons map[string]*model.Person
	MappedPersons   map[string]*model.Person
}

func (p *PersonIdentifier) Process(ctx *PipelineContext) error {
	p.MappedPersons = make(map[string]*model.Person)
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

func (s *PersonIdentifier) Name() string {
	return "PersonIdentifier"
}
