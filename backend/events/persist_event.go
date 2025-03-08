package events

import (
	"analytics/log"
	"analytics/model"
	"encoding/json"
	"github.com/google/uuid"
)

func (p *ProjectProcessor) persistEvents(events []*model.Event) {
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
