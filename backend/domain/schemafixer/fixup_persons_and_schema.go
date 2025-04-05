package schemafixer

import (
	"analytics/database/analyticsdb"
	"analytics/domain/events"
	"analytics/domain/events/processor"
	"analytics/util"
	"errors"
	"slices"
)

func FixupPersonsAndSchema(project string) error {
	analyticsDb := analyticsdb.LookupTable[project]
	if analyticsDb == nil {
		return errors.New("project not found")
	}
	e, err := events.QueryEvents(analyticsDb, nil)
	if err != nil {
		return err
	}

	p := processor.GetOrCreateProcessor(project)

	slices.SortFunc(*e, func(i, j events.EventWithPersonId) int {
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
	util.ProcessBatched(e, 10000, func(batch []events.EventWithPersonId) {
		inputEvents := make([]*events.EventInput, len(batch))
		for i, event := range batch {
			inputEvents[i] = &events.EventInput{
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
