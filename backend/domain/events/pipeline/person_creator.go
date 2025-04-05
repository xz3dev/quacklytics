package pipeline

import (
	"analytics/domain/person"
	"github.com/google/uuid"
)

type personCreator struct {
	CreatedPersons  map[string]*person.Person
	existingPersons map[string]*person.Person
}

func (p *personCreator) Process(ctx *PipelineContext) error {
	p.CreatedPersons = make(map[string]*person.Person)

	for _, event := range ctx.OutputEvents {
		_, exists := p.existingPersons[event.DistinctId]
		if !exists {
			personId := uuid.New()
			p.CreatedPersons[event.DistinctId] = &person.Person{
				Id:         personId,
				FirstSeen:  event.Timestamp,
				Properties: make(person.PersonProperties),
			}
			p.existingPersons[event.DistinctId] = p.CreatedPersons[event.DistinctId]
		}
	}
	return nil
}

func (s *personCreator) Name() string {
	return "PersonCreator"
}
