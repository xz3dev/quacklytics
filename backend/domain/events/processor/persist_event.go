package processor

import (
	"analytics/domain/events"
	"analytics/log"
	"encoding/json"
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
		personPropertiesJson, err := json.Marshal(event.PersonProperties)
		if err != nil {
			log.Error("Project %s: Error marshaling person properties: %v", p.projectID, err)
			continue
		}

		err = appender.AppendRow(
			mapUuid(event.Id),
			event.Timestamp,
			event.EventType,
			nullableString(event.SessionId),
			nullableString(event.PersonId),
			string(propertiesJson),
			string(personPropertiesJson),
		)
		if err != nil {
			log.Error("Project %s: Error appending row: %v", p.projectID, err)
			continue
		}
	}
}
