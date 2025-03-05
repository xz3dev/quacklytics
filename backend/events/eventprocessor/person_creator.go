package eventprocessor

import (
	"analytics/model"
	"github.com/google/uuid"
)

type PersonCreator struct {
	CreatedPersons      map[string]*model.Person
	ReidentifiedPersons map[string]string // from id to id
	existingPersons     map[string]*model.Person
}

func (p *PersonCreator) Process(ctx *PipelineContext) error {
	p.CreatedPersons = make(map[string]*model.Person)

	for _, event := range ctx.OutputEvents {
		if event.EventId.PersonId == uuid.Nil {
			person, exists := p.existingPersons[event.DistinctId]
			if exists {
				event.EventId.PersonId = person.Id
			} else {
				personId := uuid.New()
				p.CreatedPersons[event.DistinctId] = &model.Person{
					Id:         personId,
					FirstSeen:  event.Timestamp,
					Properties: make(model.PersonProperties),
				}
				p.existingPersons[event.DistinctId] = p.CreatedPersons[event.DistinctId]
				event.EventId.PersonId = personId
			}
		}
	}
	return nil
}
