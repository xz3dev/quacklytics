package eventprocessor

import (
	"analytics/model"
	"github.com/google/uuid"
)

type PersonCreator struct {
	CreatedPersons map[string]*model.Person
}

func (p *PersonCreator) Process(ctx *PipelineContext) error {
	p.CreatedPersons = make(map[string]*model.Person)
	for _, event := range ctx.OutputEvents {
		if event.EventId.PersonId == uuid.Nil {
			personId := uuid.New()
			p.CreatedPersons[event.DistinctId] = &model.Person{
				Id:         personId,
				FirstSeen:  event.Timestamp,
				Properties: make(model.PersonProperties),
			}
			event.EventId.PersonId = personId
		}
	}
	return nil
}
