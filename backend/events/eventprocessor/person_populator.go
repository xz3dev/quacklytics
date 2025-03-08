package eventprocessor

import (
	"analytics/model"
)

type PersonPopulator struct {
	existingPersons map[string]*model.Person
}

func (p *PersonPopulator) Process(ctx *PipelineContext) error {
	//for _, event := range ctx.OutputEvents {
	//	person, exists := p.existingPersons[event.DistinctId]
	//	if exists {
	//		event.EventId.PersonId = person.Id
	//	}
	//}
	return nil
}
