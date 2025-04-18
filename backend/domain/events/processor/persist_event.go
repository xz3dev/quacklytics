package processor

import (
	"analytics/domain/events"
	"analytics/log"
	"encoding/json"
	"github.com/google/uuid"
)

func (p *ProjectProcessor) PersistEvents(events []*events.Event) {
	appender := p.dbd.Appender("events")
	defer appender.Close()

	for _, event := range events {
		propertiesJson, err := json.Marshal(event.Properties)
		if err != nil {
			log.Error("Project %s: Error marshaling properties: %v", p.projectID, err)
			continue
		}

		err = appender.AppendRow(
			mapUuid(uuid.New()),
			event.Timestamp,
			event.EventType,
			event.DistinctId,
			propertiesJson,
		)
		if err != nil {
			log.Error("Project %s: Error appending row: %v", p.projectID, err)
			continue
		}
	}
}
