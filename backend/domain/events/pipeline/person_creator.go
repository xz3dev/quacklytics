package pipeline

import (
	"analytics/model"
	"github.com/google/uuid"
)

type personCreator struct {
	CreatedPersons  map[string]*model.Person
	existingPersons map[string]*model.Person
}

func (p *personCreator) Process(ctx *PipelineContext) error {
	p.CreatedPersons = make(map[string]*model.Person)

	for _, event := range ctx.OutputEvents {
		_, exists := p.existingPersons[event.DistinctId]
		if !exists {
			personId := uuid.New()
			p.CreatedPersons[event.DistinctId] = &model.Person{
				Id:         personId,
				FirstSeen:  event.Timestamp,
				Properties: make(model.PersonProperties),
			}
			p.existingPersons[event.DistinctId] = p.CreatedPersons[event.DistinctId]
		}
	}
	return nil
}

func (s *personCreator) Name() string {
	return "PersonCreator"
}
