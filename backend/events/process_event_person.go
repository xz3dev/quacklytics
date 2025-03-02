package events

import (
	db_ext "analytics/database/db-ext"
	"analytics/log"
	"analytics/model"
	"encoding/json"
	"fmt"
	"github.com/google/uuid"
	"github.com/marcboeker/go-duckdb"
	"slices"
	"strings"
	"time"
)

func getExistingPersons(p *ProjectProcessor, events []*model.EventInput) (map[string]*model.Person, error) {
	tx, err := p.dbd.Tx()
	defer tx.Commit()

	if err != nil {
		log.Error("Error while creating transaction: ", err)
		return nil, err
	}

	var distinctIds db_ext.StringList
	for _, event := range events {
		if event.DistinctId != "" {
			distinctIds = append(distinctIds, event.DistinctId)
		}
	}

	idMappingRows, err := tx.Query(`
		SELECT person_id, distinct_id
		FROM person_distinct_ids
		WHERE list_contains($1::TEXT[], distinct_id)
	`, distinctIds)
	if err != nil {
		return make(map[string]*model.Person), err
	}
	defer idMappingRows.Close()
	distinctIdMappings := make(map[string]uuid.UUID)
	personIdsMap := make(map[uuid.UUID]bool)
	for idMappingRows.Next() {
		var personId uuid.UUID
		var distinctId string
		if err := idMappingRows.Scan(&personId, &distinctId); err != nil {
			return nil, err
		}
		distinctIdMappings[distinctId] = personId
		personIdsMap[personId] = true
	}

	personIds := make(db_ext.UUIDList, len(personIdsMap))
	i := 0
	for personId := range personIdsMap {
		personIds[i] = duckdb.UUID(personId)
		i++
	}

	persons := make(map[uuid.UUID]*model.Person)

	rows, err := tx.Query(`
        SELECT id, first_seen, properties
        FROM persons
        WHERE list_contains($1::UUID[], id)
    `, personIds)
	defer rows.Close()
	if err != nil {
		log.Error("Error querying existing persons: %v", err)
		return nil, err
	}

	for rows.Next() {
		var person model.Person

		if err := rows.Scan(&person.Id, &person.FirstSeen, &person.Properties); err != nil {
			return nil, err
		}

		persons[person.Id] = &person
	}

	personsByDistinctId := make(map[string]*model.Person)
	for k, v := range distinctIdMappings {
		personsByDistinctId[k] = persons[v]
	}

	return personsByDistinctId, nil
}

func (p *ProjectProcessor) ProcessPeopleDataBatch(events []*model.EventInput) ([]*model.Event, error) {
	startTime := time.Now()

	eventsWithPerson := make([]*model.Event, len(events))

	newPersons := make(map[uuid.UUID]*model.Person)
	updatedPersons := make(map[uuid.UUID]*model.Person)
	distinctIdMappings := make(map[string]uuid.UUID)

	existingPersons, err := getExistingPersons(p, events)
	if err != nil {
		log.Error("Error getting existing persons: %v", err)
		return nil, err
	}

	tx, err := p.dbd.Tx()
	if err != nil {
		log.Error("Error while creating transaction: ", err)
		return nil, err
	}
	defer tx.Commit()

	for index, event := range events {
		if event.DistinctId != "" {
			existing, personExists := existingPersons[event.DistinctId]

			props := make(model.PersonProperties)
			if personExists {
				props = existing.Properties
			}

			setProps := event.Properties["$set"]
			setOnceProps := event.Properties["$set_once"]

			setPropsSafe, ok := setProps.(map[string]any)
			updated := false
			if ok {
				props.ApplySetProps(setPropsSafe)
				updated = true
			}
			setOncePropsSafe, ok := setOnceProps.(map[string]any)
			if ok {
				props.ApplySetOnceProps(setOncePropsSafe)
				updated = true
			}

			eventsWithPerson[index] = &model.Event{
				EventInput: *event,
				EventId: model.EventId{
					Id:       uuid.New(),
					PersonId: uuid.Nil,
				},
			}
			if !personExists {
				id := uuid.New()
				newPersons[id] = &model.Person{
					Id:         id,
					FirstSeen:  event.Timestamp,
					Properties: props,
				}
				existingPersons[event.DistinctId] = newPersons[id]
				eventsWithPerson[index].EventId.PersonId = id
			} else {
				if updated {
					updatedPersons[existing.Id] = existing
					updatedPersons[existing.Id].Properties = props
				}
				eventsWithPerson[index].EventId.PersonId = existing.Id
			}
		}
	}
	personsAppender := p.dbd.Appender("persons")

	if len(newPersons) > 0 {
		for personId, person := range newPersons {
			propJson, err := json.Marshal(person.Properties)
			if err != nil {
				log.Error("Error marshalling person properties: %v", err)
				continue
			}
			err = personsAppender.AppendRow(mapUuid(personId), person.FirstSeen, propJson)
			if err != nil {
				log.Error("Error inserting person: %v", err)
				continue
			}
		}
	}
	err = personsAppender.Close()
	if err != nil {
		log.Error("Error closing person appender: %v", err)
		return nil, err
	}

	// Insert distinct ID mappings
	if len(distinctIdMappings) > 0 {
		var values strings.Builder
		params := make([]interface{}, 0)
		i := 1
		for distinctId, personId := range distinctIdMappings {
			if i > 1 {
				values.WriteString(", ")
			}
			values.WriteString(fmt.Sprintf("($%d::UUID, $%d::TEXT)", i, i+1))
			params = append(params, personId.String(), distinctId)
			i += 2
		}
		expandedQuery := fmt.Sprintf("INSERT OR IGNORE INTO person_distinct_ids (person_id, distinct_id) VALUES %s", values.String())
		_, err = tx.Exec(expandedQuery, params...)
		if err != nil {
			log.Info("Error inserting person distinct IDs: %v", err)
			return nil, err
		}
	}

	if len(updatedPersons) > 0 {
		for personId, person := range updatedPersons {
			_, err = tx.Exec("UPDATE persons SET properties = json($2) where id = $1", personId.String(), person.Properties)
			if err != nil {
				log.Info("Error updating person: %v", err)
				continue
			}
		}
	}

	duration := time.Since(startTime)
	log.Info("Project %s: Processed people data batch in %v (persons: %d, mappings: %d)",
		p.projectID, duration, len(newPersons), len(distinctIdMappings))
	return eventsWithPerson, nil
}

func sortEventInputsByTimeAsc(events []*model.EventInput) {
	slices.SortFunc(events, func(i, j *model.EventInput) int {
		if i.Timestamp.Equal(j.Timestamp) {
			return 0
		}
		if i.Timestamp.Before(j.Timestamp) {
			return -1
		}
		return 1
	})
}
