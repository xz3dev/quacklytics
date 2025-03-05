package posthog

import (
	"analytics/actions"
	events2 "analytics/events"
	"analytics/log"
	"analytics/model"
	svmw "analytics/server/middlewares"
	"encoding/json"
	"fmt"
	"github.com/go-chi/chi/v5"
	"net/http"
	"time"
)

func SetupPosthogRoutes(mux *chi.Mux) {
	mux.Group(func(mux chi.Router) {
		mux.Use(svmw.DecompressionMiddleware)
		mux.Post("/e/", PosthogHandler)
		mux.Post("/decide/", EmptyOkResponse)
		mux.Get("/array/{apikey}/config.js", EmptyOkResponse)
		mux.Get("/array/{apikey}/config", EmptyOkResponse)
	})
}

func EmptyOkResponse(w http.ResponseWriter, r *http.Request) {
	w.Header().Set("Content-Type", "application/json")
	w.Write([]byte("{}"))
}

type posthogEvent struct {
	UUID       string                 `json:"uuid"`
	Event      string                 `json:"event"`
	Properties map[string]interface{} `json:"properties"`
	Offset     *int                   `json:"offset"`
	Timestamp  string                 `json:"timestamp"`
}

type posthogEventList []posthogEvent

func calculateEventTime(e posthogEvent, baseTime time.Time) time.Time {
	eventTime := baseTime
	if e.Offset != nil {
		eventTime = eventTime.Add(time.Duration(*e.Offset) * time.Millisecond)
	}
	if e.Timestamp != "" {
		if parsedTime, err := time.Parse(time.RFC3339, e.Timestamp); err == nil && !parsedTime.IsZero() {
			eventTime = parsedTime
		}
	}
	return eventTime
}

func extractIdentifiers(e posthogEvent) (string, string, bool) {
	token, ok := e.Properties["token"].(string)
	if !ok || token == "" {
		log.Info("No token found in event properties. Skipping event: %s", e.UUID)
		return "", "", false
	}

	distinctId, ok := e.Properties["distinct_id"].(string)
	if !ok || distinctId == "" {
		log.Info("No distinct_id found in event properties. Skipping event: %s", e.UUID)
		return "", "", false
	}

	return token, distinctId, true
}

func PosthogHandler(w http.ResponseWriter, r *http.Request) {
	var events posthogEventList
	if err := json.NewDecoder(r.Body).Decode(&events); err != nil {
		http.Error(w, "Unable to parse request body: "+err.Error(), http.StatusBadRequest)
		return
	}

	// Create a map to group event inputs by token.
	eventInputsByToken := make(map[string][]*model.EventInput)
	now := time.Now()
	for _, e := range events {
		eventTime := calculateEventTime(e, now)

		token, distinctId, valid := extractIdentifiers(e)
		if !valid {
			continue
		}

		eventInput := model.EventInput{
			EventType:  e.Event,
			DistinctId: distinctId,
			Timestamp:  eventTime,
			Properties: e.Properties,
		}
		eventInputsByToken[token] = append(eventInputsByToken[token], &eventInput)
	}

	appdb := svmw.GetAppDB(r)

	for token, eventsByToken := range eventInputsByToken {
		projectId, err := actions.ValidateAPIKey(appdb, token)
		if err != nil {
			log.Error("Error while validating API key: %v. Skipping %d events.", err, len(eventsByToken))
			continue
		}
		events2.ProcessEvents(projectId, eventsByToken)
	}

	w.WriteHeader(http.StatusOK)
	w.Write([]byte("Events added to Queue"))
}

func (p *posthogEventList) UnmarshalJSON(data []byte) error {
	// First, try to unmarshal data into a slice of events.
	var events []posthogEvent
	if err := json.Unmarshal(data, &events); err == nil {
		*p = events
		return nil
	}

	// If unmarshalling as a slice fails, try unmarshalling a single event.
	var event posthogEvent
	if err := json.Unmarshal(data, &event); err != nil {
		return fmt.Errorf("failed to unmarshal data as either []posthogEvent or posthogEvent: %w", err)
	}

	*p = []posthogEvent{event}
	return nil
}
