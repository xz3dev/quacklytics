package actions

import (
	"analytics/database/analyticsdb"
	"analytics/events"
	"analytics/model"
	"analytics/util"
	"errors"
	"slices"
)

func FixupPersonsAndSchema(project string) error {
	analyticsDb := analyticsdb.LookupTable[project]
	if analyticsDb == nil {
		return errors.New("project not found")
	}
	e, err := QueryEvents(analyticsDb, nil)
	if err != nil {
		return err
	}

	p := events.GetOrCreateProcessor(project)

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
	var outerErr error
	util.ProcessBatched(e, 10000, func(batch []model.Event) {
		inputEvents := make([]*model.EventInput, len(batch))
		for i, event := range batch {
			inputEvents[i] = &model.EventInput{
				EventType:  event.EventType,
				DistinctId: event.DistinctId,
				Timestamp:  event.Timestamp,
				Properties: event.Properties,
			}
		}

		processor, err := p.NewEventProcessor(inputEvents)
		if err != nil {
			outerErr = err
			return
		}

		output, err := processor.Process()
		if err != nil {
			outerErr = err
			return
		}

		p.CreatePersons(output.NewPersons, output.MappedPersons)
		p.UpdatePersons(output.UpdatedPersons)
		p.PersistAllSchemas(output.Schema)
	})

	return outerErr
}
