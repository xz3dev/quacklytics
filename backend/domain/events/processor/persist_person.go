package processor

import (
	"analytics/domain/person"
	"analytics/internal/log"
	"database/sql"
	"encoding/json"
	"fmt"
	"github.com/google/uuid"
	"strings"
	"time"
)

func (p *ProjectProcessor) CreatePersons(newPersons map[string]*person.Person, mappedPersons map[string]*person.Person) {
	start := time.Now()
	tx, err := p.dbd.Tx()
	personsAppender := p.dbd.Appender("persons")

	uniquePersons := make(map[uuid.UUID]*person.Person)
	for _, person := range newPersons {
		uniquePersons[person.Id] = person
	}

	for _, person := range uniquePersons {
		propJson, err := json.Marshal(person.Properties)
		if err != nil {
			log.Error("Error marshalling person properties: %v", err)
			continue
		}
		err = personsAppender.AppendRow(mapUuid(person.Id), person.FirstSeen, propJson)
		if err != nil {
			log.Error("Error inserting person: %v", err)
			continue
		}
	}
	personsAppender.Flush()
	p.createPersonMappings(tx, mappedPersons)
	p.createPersonMappings(tx, newPersons)

	err = tx.Commit()
	if err != nil {
		log.Error("Error inserting events: ", err.Error())
	}
	personsAppender.Close()
	elapsed := time.Since(start)
	log.Debug("Persisted %d persons in %v", len(newPersons), elapsed)
}

func (p *ProjectProcessor) createPersonMappings(tx *sql.Tx, mappings map[string]*person.Person) error {
	start := time.Now()
	if len(mappings) == 0 {
		return nil
	}
	var values strings.Builder
	params := make([]interface{}, 0)
	i := 1
	for distinctId, person := range mappings {
		if i > 1 {
			values.WriteString(", ")
		}
		values.WriteString(fmt.Sprintf("($%d::UUID, $%d::TEXT)", i, i+1))
		params = append(params, person.Id.String(), distinctId)
		i += 2
	}
	expandedQuery := fmt.Sprintf("INSERT OR IGNORE INTO person_distinct_ids (person_id, distinct_id) VALUES %s", values.String())
	_, err := tx.Exec(expandedQuery, params...)
	if err != nil {
		log.Info("Error inserting person distinct IDs: %v", err)
		return err
	}
	elapsed := time.Since(start)
	log.Debug("Persisted %d person mappings in %v", len(mappings), elapsed)
	return nil
}

func (p *ProjectProcessor) UpdatePersons(updatedPersons map[string]*person.Person) error {
	start := time.Now()
	tx, err := p.dbd.Tx()
	if err != nil {
		log.Error("Error while creating transaction: ", err)
		return err
	}

	for _, person := range updatedPersons {
		_, err = tx.Exec("UPDATE persons SET properties = json($2) where id = $1", person.Id.String(), person.Properties)
		if err != nil {
			log.Info("Error updating person: %v", err)
			continue
		}
	}
	elapsed := time.Since(start)
	log.Debug("Updated %d persons in %v", len(updatedPersons), elapsed)
	return tx.Commit()
}
