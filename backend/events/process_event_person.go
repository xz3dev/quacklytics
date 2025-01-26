package events

import (
	"analytics/database/analyticsdb"
	db_ext "analytics/database/db-ext"
	"analytics/model"
	"encoding/json"
	"github.com/google/uuid"
	"log"
	"time"
)

func getExistingPersons(projectID string, events []*model.EventInput) (map[uuid.UUID]*model.Person, error) {
	tx, err := analyticsdb.Tx(projectID)
	defer tx.Commit()

	if err != nil {
		log.Println("Error while creating transaction: ", err)
		return nil, err
	}
	var ids db_ext.UUIDList
	for _, event := range events {
		if event.PersonId != uuid.Nil {
			ids = append(ids, mapUuid(event.PersonId))
		}
	}

	rows, err := tx.Query(`
        SELECT id, first_seen, properties
        FROM persons
        WHERE list_contains($1::UUID[], id)
    `, ids)
	defer rows.Close()

	persons := make(map[uuid.UUID]*model.Person)
	if err != nil {
		log.Printf("Error querying existing persons: %v", err)
		return nil, err
	}

	for rows.Next() {
		var person model.Person

		if err := rows.Scan(&person.Id, &person.FirstSeen, &person.Properties); err != nil {
			return nil, err
		}

		persons[person.Id] = &person
	}

	return persons, nil
}

func (p *ProjectProcessor) ProcessPeopleDataBatch(events []*model.EventInput) {
	startTime := time.Now()

	// Maps to collect unique updates needed
	//personIds := make(map[uuid.UUID]struct{})
	distinctIdMappings := make(map[string]uuid.UUID)
	newPersons := make(map[uuid.UUID]*model.Person)
	updatedPersons := make(map[uuid.UUID]*model.Person)

	existingPersons, err := getExistingPersons(p.projectID, events)
	if err != nil {
		log.Printf("Error getting existing persons: %v", err)
		return
	}

	log.Printf("Project %s: Found %d existing persons", p.projectID, len(existingPersons))

	tx, err := analyticsdb.Tx(p.projectID)
	defer tx.Commit()
	if err != nil {
		log.Println("Error while creating transaction: ", err)
		return
	}

	for _, event := range events {
		if event.PersonId != uuid.Nil && event.DistinctId != "" {
			distinctIdMappings[event.DistinctId] = event.PersonId

			// Check if person exists
			existing, exists := existingPersons[event.PersonId]

			props := make(model.PersonProperties)
			if exists {
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
			if !exists {
				newPersons[event.PersonId] = &model.Person{
					Id:         event.PersonId,
					FirstSeen:  event.Timestamp,
					Properties: props,
				}
			} else if updated {
				updatedPersons[event.PersonId] = existing
				props["test"] = "test"
				updatedPersons[event.PersonId].Properties = props
			}
		}
	}
	personsAppender := analyticsdb.Appender(p.projectID, "persons")

	//personsDistinctIdsAppender := analyticsdb.Appender(p.projectID, "person_distinct_ids")

	if len(newPersons) > 0 {
		for personId, person := range newPersons {
			propJson, err := json.Marshal(person.Properties)
			if err != nil {
				log.Printf("Error marshalling person properties: %v", err)
				continue
			}
			err = personsAppender.AppendRow(mapUuid(personId), person.FirstSeen, propJson)
			if err != nil {
				log.Printf("Error inserting person: %v", err)
				continue
			}
			log.Printf("Inserted person: %s", personId)
			//if _, err := stmt.Exec(personId, firstSeen); err != nil {
			//	log.Printf("Error inserting person: %v", err)
			//}
		}
	}
	personsAppender.Close()

	if len(updatedPersons) > 0 {
		for personId, person := range updatedPersons {
			_, err = tx.Exec("UPDATE persons SET properties = json($2) where id = $1", personId.String(), person.Properties)
			if err != nil {
				log.Printf("Error updating person: %v", err)
				continue
			}
			log.Printf("UPSERTED person: %s", personId)
			//if _, err := stmt.Exec(personId, firstSeen); err != nil {
			//	log.Printf("Error inserting person: %v", err)
			//}
		}
	}
	// Insert distinct ID mappings
	//if len(distinctIdMappings) > 0 {
	//	stmt, err := tx.Prepare(`
	//        INSERT INTO person_distinct_ids (person_id, distinct_id)
	//        VALUES ($1, $2)
	//        ON CONFLICT (person_id, distinct_id) DO NOTHING
	//    `)
	//	if err != nil {
	//		log.Printf("Error preparing distinct_id mapping insert: %v", err)
	//		return
	//	}
	//	defer stmt.Close()
	//
	//	for distinctId, personId := range distinctIdMappings {
	//		if _, err := stmt.Exec(personId, distinctId); err != nil {
	//			log.Printf("Error inserting distinct_id mapping: %v", err)
	//		}
	//	}
	//}

	duration := time.Since(startTime)
	log.Printf("Project %s: Processed people data batch in %v (persons: %d, mappings: %d)",
		p.projectID, duration, len(newPersons), len(distinctIdMappings))
}
