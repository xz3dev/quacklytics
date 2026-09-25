package processor

import (
	"analytics/domain/events"
	"analytics/domain/person"
	"testing"
	"time"
)

func TestAnonymousEventDoesNotCreateIdentity(t *testing.T) {
	input := []*events.Event{
		{
			EventInput: events.EventInput{
				EventType: "page_view",
				Timestamp: time.Now(),
				Properties: map[string]any{
					"path": "/",
				},
			},
		},
	}

	sessions, linkedSessions := resolveSessions(input, map[string]*sessionState{})
	personIds := collectPersonIds(input, sessions)
	updates := collectPropertyUpdates(input, sessions)

	if len(sessions) != 0 {
		t.Fatalf("expected no sessions, got %d", len(sessions))
	}
	if len(linkedSessions) != 0 {
		t.Fatalf("expected no linked sessions, got %d", len(linkedSessions))
	}
	if len(personIds) != 0 {
		t.Fatalf("expected no persons, got %d", len(personIds))
	}
	if len(updates) != 0 {
		t.Fatalf("expected no person property updates, got %d", len(updates))
	}
}

func TestSessionUpgradeAppliesLatestPersonPropertiesByTimestamp(t *testing.T) {
	t1 := time.Date(2026, 1, 1, 12, 0, 0, 0, time.UTC)
	t2 := t1.Add(time.Minute)
	t3 := t2.Add(time.Minute)
	sessionId := "session_1"
	personId := "person_1"

	input := []*events.Event{
		{
			EventInput: events.EventInput{
				EventType: "page_view",
				SessionId: &sessionId,
				Timestamp: t2,
				PersonProperties: map[string]any{
					"plan": "paid",
				},
			},
		},
		{
			EventInput: events.EventInput{
				EventType: "page_view",
				SessionId: &sessionId,
				Timestamp: t1,
				PersonProperties: map[string]any{
					"plan": "free",
				},
			},
		},
		{
			EventInput: events.EventInput{
				EventType: "login",
				SessionId: &sessionId,
				PersonId:  &personId,
				Timestamp: t3,
			},
		},
	}

	sessions, _ := resolveSessions(input, map[string]*sessionState{})
	personIds := collectPersonIds(input, sessions)
	updates := collectPropertyUpdates(input, sessions)
	persons := buildPersons(personIds, map[string]*person.Person{}, input, updates)
	applyPropertyUpdates(persons, updates)

	personRecord := persons[personId]
	if personRecord == nil {
		t.Fatal("expected upgraded session to create person")
	}
	if got := personRecord.Properties["plan"]; got != "paid" {
		t.Fatalf("expected latest property value, got %v", got)
	}
	if got := personRecord.PropertyTimestamps["plan"]; !got.Equal(t2) {
		t.Fatalf("expected latest property timestamp %s, got %s", t2, got)
	}
}
