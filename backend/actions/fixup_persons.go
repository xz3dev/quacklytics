package actions

import (
	"analytics/database/analyticsdb"
	"analytics/events"
	"analytics/model"
	"analytics/util"
	"gorm.io/gorm"
	"log"
	"slices"
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

	slices.SortFunc(*e, func(i, j model.Event) int {
		if i.Timestamp.Equal(j.Timestamp) {
			return 0
		}
		isBefore := i.Timestamp.Before(j.Timestamp)
		if isBefore {
			return -1
		}
		return 1
	})

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
