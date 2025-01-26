package actions

import (
	"analytics/database/analyticsdb"
	"analytics/events"
	"analytics/model"
	"analytics/util"
	"gorm.io/gorm"
	"log"
)

func FixupPersons(project string, db *gorm.DB) error {
	analyticsDb := analyticsdb.LookupTable[project]
	if analyticsDb == nil {
		return &FixupError{
			Message: "test",
		}
	}
	e, err := QueryEvents(project, nil)
	if err != nil {
		return err
	}

	p := events.GetOrCreateProcessor(project, db)

	util.ProcessBatched(e, 10000, func(batch []model.Event) {
		log.Printf("Processing batch of %d events", len(batch))
		inputs := make([]*model.EventInput, len(batch))
		for i, event := range batch {
			inputs[i] = &event.EventInput
		}
		p.ProcessPeopleDataBatch(inputs)
	})
	return nil
}
