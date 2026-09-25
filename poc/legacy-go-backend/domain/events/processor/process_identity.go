package processor

import (
	"analytics/database/types"
	"analytics/domain/events"
	"analytics/domain/person"
	"analytics/log"
	"database/sql"
	"encoding/json"
	"fmt"
	"strings"
	"time"
)

type sessionState struct {
	Id        string
	PersonId  *string
	FirstSeen time.Time
	LastSeen  time.Time
}

type propertyUpdate struct {
	PersonId   string
	Timestamp  time.Time
	Properties person.PersonProperties
}

func (p *ProjectProcessor) ProcessIdentities(input []*events.Event) error {
	sessionIds := collectSessionIds(input)
	existingSessions, err := p.fetchSessions(sessionIds)
	if err != nil {
		return err
	}

	sessions, newlyLinkedSessions := resolveSessions(input, existingSessions)
	personIds := collectPersonIds(input, sessions)
	existingPersons, err := p.fetchPersons(personIds)
	if err != nil {
		return err
	}

	personUpdates := collectPropertyUpdates(input, sessions)
	historicalUpdates, err := p.fetchHistoricalSessionPropertyUpdates(newlyLinkedSessions)
	if err != nil {
		return err
	}
	personUpdates = append(personUpdates, historicalUpdates...)

	persons := buildPersons(personIds, existingPersons, input, personUpdates)
	applyPropertyUpdates(persons, personUpdates)

	if err := p.persistPersons(persons, existingPersons); err != nil {
		return err
	}
	return p.persistSessions(sessions, existingSessions)
}

func collectSessionIds(input []*events.Event) types.StringList {
	seen := make(map[string]bool)
	sessionIds := make(types.StringList, 0)
	for _, event := range input {
		if event.SessionId == nil || *event.SessionId == "" {
			continue
		}
		if seen[*event.SessionId] {
			continue
		}
		seen[*event.SessionId] = true
		sessionIds = append(sessionIds, *event.SessionId)
	}
	return sessionIds
}

func (p *ProjectProcessor) fetchSessions(sessionIds types.StringList) (map[string]*sessionState, error) {
	sessions := make(map[string]*sessionState)
	if len(sessionIds) == 0 {
		return sessions, nil
	}

	tx, err := p.dbd.Tx()
	if err != nil {
		return nil, err
	}
	defer tx.Commit()

	rows, err := tx.Query(`
		SELECT id, person_id, first_seen, last_seen
		FROM sessions
		WHERE list_contains($1::TEXT[], id)
	`, sessionIds)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	for rows.Next() {
		var session sessionState
		var personId sql.NullString
		if err := rows.Scan(&session.Id, &personId, &session.FirstSeen, &session.LastSeen); err != nil {
			return nil, err
		}
		if personId.Valid {
			session.PersonId = &personId.String
		}
		sessions[session.Id] = &session
	}

	return sessions, nil
}

func resolveSessions(input []*events.Event, existingSessions map[string]*sessionState) (map[string]*sessionState, map[string]string) {
	sessions := make(map[string]*sessionState)
	newlyLinkedSessions := make(map[string]string)

	for _, existing := range existingSessions {
		copy := *existing
		sessions[existing.Id] = &copy
	}

	for _, event := range input {
		if event.SessionId == nil || *event.SessionId == "" {
			continue
		}

		session, exists := sessions[*event.SessionId]
		if !exists {
			session = &sessionState{
				Id:        *event.SessionId,
				FirstSeen: event.Timestamp,
				LastSeen:  event.Timestamp,
			}
			sessions[session.Id] = session
		}

		if event.Timestamp.Before(session.FirstSeen) {
			session.FirstSeen = event.Timestamp
		}
		if event.Timestamp.After(session.LastSeen) {
			session.LastSeen = event.Timestamp
		}

		if event.PersonId != nil && *event.PersonId != "" {
			wasAnonymous := session.PersonId == nil || *session.PersonId == ""
			personId := *event.PersonId
			session.PersonId = &personId
			if wasAnonymous {
				newlyLinkedSessions[session.Id] = personId
			}
		}
	}

	return sessions, newlyLinkedSessions
}

func collectPersonIds(input []*events.Event, sessions map[string]*sessionState) types.StringList {
	seen := make(map[string]bool)
	personIds := make(types.StringList, 0)
	add := func(personId string) {
		if personId == "" || seen[personId] {
			return
		}
		seen[personId] = true
		personIds = append(personIds, personId)
	}

	for _, event := range input {
		if event.PersonId != nil {
			add(*event.PersonId)
		}
		if event.SessionId != nil {
			if session, ok := sessions[*event.SessionId]; ok && session.PersonId != nil {
				add(*session.PersonId)
			}
		}
	}

	return personIds
}

func (p *ProjectProcessor) fetchPersons(personIds types.StringList) (map[string]*person.Person, error) {
	persons := make(map[string]*person.Person)
	if len(personIds) == 0 {
		return persons, nil
	}

	tx, err := p.dbd.Tx()
	if err != nil {
		return nil, err
	}
	defer tx.Commit()

	rows, err := tx.Query(`
		SELECT id, first_seen, properties, property_timestamps
		FROM persons
		WHERE list_contains($1::TEXT[], id)
	`, personIds)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	for rows.Next() {
		var personRecord person.Person
		if err := rows.Scan(
			&personRecord.Id,
			&personRecord.FirstSeen,
			&personRecord.Properties,
			&personRecord.PropertyTimestamps,
		); err != nil {
			return nil, err
		}
		if personRecord.Properties == nil {
			personRecord.Properties = make(person.PersonProperties)
		}
		if personRecord.PropertyTimestamps == nil {
			personRecord.PropertyTimestamps = make(person.PropertyTimestamps)
		}
		persons[personRecord.Id] = &personRecord
	}

	return persons, nil
}

func collectPropertyUpdates(input []*events.Event, sessions map[string]*sessionState) []propertyUpdate {
	updates := make([]propertyUpdate, 0)
	for _, event := range input {
		if len(event.PersonProperties) == 0 {
			continue
		}

		personId := ""
		if event.PersonId != nil {
			personId = *event.PersonId
		}
		if personId == "" && event.SessionId != nil {
			if session, ok := sessions[*event.SessionId]; ok && session.PersonId != nil {
				personId = *session.PersonId
			}
		}
		if personId == "" {
			continue
		}

		updates = append(updates, propertyUpdate{
			PersonId:   personId,
			Timestamp:  event.Timestamp,
			Properties: person.PersonProperties(event.PersonProperties),
		})
	}
	return updates
}

func (p *ProjectProcessor) fetchHistoricalSessionPropertyUpdates(newlyLinkedSessions map[string]string) ([]propertyUpdate, error) {
	if len(newlyLinkedSessions) == 0 {
		return nil, nil
	}

	sessionIds := make(types.StringList, 0, len(newlyLinkedSessions))
	for sessionId := range newlyLinkedSessions {
		sessionIds = append(sessionIds, sessionId)
	}

	tx, err := p.dbd.Tx()
	if err != nil {
		return nil, err
	}
	defer tx.Commit()

	rows, err := tx.Query(`
		SELECT session_id, timestamp, person_properties
		FROM events
		WHERE session_id IS NOT NULL
		  AND list_contains($1::TEXT[], session_id)
	`, sessionIds)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	updates := make([]propertyUpdate, 0)
	for rows.Next() {
		var sessionId string
		var timestamp time.Time
		var propertiesValue any
		if err := rows.Scan(&sessionId, &timestamp, &propertiesValue); err != nil {
			return nil, err
		}
		properties, err := events.ParseJSONProperties(propertiesValue)
		if err != nil {
			log.Error("Error unmarshalling historical person properties: %v", err)
			continue
		}
		props := person.PersonProperties(properties)
		if len(props) == 0 {
			continue
		}

		updates = append(updates, propertyUpdate{
			PersonId:   newlyLinkedSessions[sessionId],
			Timestamp:  timestamp,
			Properties: props,
		})
	}

	return updates, nil
}

func buildPersons(
	personIds types.StringList,
	existingPersons map[string]*person.Person,
	input []*events.Event,
	updates []propertyUpdate,
) map[string]*person.Person {
	persons := make(map[string]*person.Person)
	for _, existing := range existingPersons {
		copy := *existing
		persons[existing.Id] = &copy
	}

	firstSeen := make(map[string]time.Time)
	for _, event := range input {
		if event.PersonId != nil && *event.PersonId != "" {
			updateFirstSeen(firstSeen, *event.PersonId, event.Timestamp)
		}
	}
	for _, update := range updates {
		updateFirstSeen(firstSeen, update.PersonId, update.Timestamp)
	}

	for _, personId := range personIds {
		if _, exists := persons[personId]; exists {
			continue
		}
		seenAt := firstSeen[personId]
		if seenAt.IsZero() {
			seenAt = time.Now().UTC()
		}
		persons[personId] = &person.Person{
			Id:                 personId,
			FirstSeen:          seenAt,
			Properties:         make(person.PersonProperties),
			PropertyTimestamps: make(person.PropertyTimestamps),
		}
	}

	for personId, seenAt := range firstSeen {
		if existing, ok := persons[personId]; ok && seenAt.Before(existing.FirstSeen) {
			existing.FirstSeen = seenAt
		}
	}

	return persons
}

func updateFirstSeen(firstSeen map[string]time.Time, personId string, timestamp time.Time) {
	if timestamp.IsZero() {
		return
	}
	current, exists := firstSeen[personId]
	if !exists || timestamp.Before(current) {
		firstSeen[personId] = timestamp
	}
}

func applyPropertyUpdates(persons map[string]*person.Person, updates []propertyUpdate) {
	for _, update := range updates {
		personRecord, exists := persons[update.PersonId]
		if !exists {
			continue
		}
		if personRecord.Properties == nil {
			personRecord.Properties = make(person.PersonProperties)
		}
		if personRecord.PropertyTimestamps == nil {
			personRecord.PropertyTimestamps = make(person.PropertyTimestamps)
		}
		personRecord.Properties.ApplyLatestProps(update.Properties, personRecord.PropertyTimestamps, update.Timestamp)
	}
}

func (p *ProjectProcessor) persistSessions(sessions, existingSessions map[string]*sessionState) error {
	if len(sessions) == 0 {
		return nil
	}

	tx, err := p.dbd.Tx()
	if err != nil {
		return err
	}
	defer tx.Rollback()

	newSessions := make([]*sessionState, 0)
	updatedSessions := make([]*sessionState, 0)
	for id, session := range sessions {
		if _, exists := existingSessions[id]; exists {
			updatedSessions = append(updatedSessions, session)
		} else {
			newSessions = append(newSessions, session)
		}
	}

	if len(newSessions) > 0 {
		values, params := sessionInsertValues(newSessions)
		query := fmt.Sprintf("INSERT INTO sessions (id, person_id, first_seen, last_seen) VALUES %s", values)
		if _, err := tx.Exec(query, params...); err != nil {
			return err
		}
	}

	for _, session := range updatedSessions {
		_, err := tx.Exec(
			"UPDATE sessions SET person_id = $2, first_seen = $3, last_seen = $4 WHERE id = $1",
			session.Id,
			nullableString(session.PersonId),
			session.FirstSeen,
			session.LastSeen,
		)
		if err != nil {
			return err
		}
	}

	return tx.Commit()
}

func sessionInsertValues(sessions []*sessionState) (string, []interface{}) {
	var values strings.Builder
	params := make([]interface{}, 0, len(sessions)*4)
	paramIndex := 1
	for i, session := range sessions {
		if i > 0 {
			values.WriteString(", ")
		}
		values.WriteString(fmt.Sprintf("($%d, $%d, $%d, $%d)", paramIndex, paramIndex+1, paramIndex+2, paramIndex+3))
		params = append(params, session.Id, nullableString(session.PersonId), session.FirstSeen, session.LastSeen)
		paramIndex += 4
	}
	return values.String(), params
}

func (p *ProjectProcessor) persistPersons(persons, existingPersons map[string]*person.Person) error {
	if len(persons) == 0 {
		return nil
	}

	tx, err := p.dbd.Tx()
	if err != nil {
		return err
	}
	defer tx.Rollback()

	newPersons := make([]*person.Person, 0)
	updatedPersons := make([]*person.Person, 0)
	for id, personRecord := range persons {
		if _, exists := existingPersons[id]; exists {
			updatedPersons = append(updatedPersons, personRecord)
		} else {
			newPersons = append(newPersons, personRecord)
		}
	}

	if len(newPersons) > 0 {
		values, params, err := personInsertValues(newPersons)
		if err != nil {
			return err
		}
		query := fmt.Sprintf("INSERT INTO persons (id, first_seen, properties, property_timestamps) VALUES %s", values)
		if _, err := tx.Exec(query, params...); err != nil {
			return err
		}
	}

	for _, personRecord := range updatedPersons {
		propertiesJson, err := json.Marshal(personRecord.Properties)
		if err != nil {
			return err
		}
		timestampsJson, err := json.Marshal(personRecord.PropertyTimestamps)
		if err != nil {
			return err
		}
		_, err = tx.Exec(
			"UPDATE persons SET first_seen = $2, properties = json($3), property_timestamps = json($4) WHERE id = $1",
			personRecord.Id,
			personRecord.FirstSeen,
			string(propertiesJson),
			string(timestampsJson),
		)
		if err != nil {
			return err
		}
	}

	return tx.Commit()
}

func personInsertValues(persons []*person.Person) (string, []interface{}, error) {
	var values strings.Builder
	params := make([]interface{}, 0, len(persons)*4)
	paramIndex := 1
	for i, personRecord := range persons {
		propertiesJson, err := json.Marshal(personRecord.Properties)
		if err != nil {
			return "", nil, err
		}
		timestampsJson, err := json.Marshal(personRecord.PropertyTimestamps)
		if err != nil {
			return "", nil, err
		}
		if i > 0 {
			values.WriteString(", ")
		}
		values.WriteString(fmt.Sprintf("($%d, $%d, json($%d), json($%d))", paramIndex, paramIndex+1, paramIndex+2, paramIndex+3))
		params = append(params, personRecord.Id, personRecord.FirstSeen, string(propertiesJson), string(timestampsJson))
		paramIndex += 4
	}
	return values.String(), params, nil
}

func nullableString(value *string) interface{} {
	if value == nil || *value == "" {
		return nil
	}
	return *value
}
