package posthog

import (
	"analytics/domain/apikeys"
	"analytics/domain/events"
	"analytics/domain/events/processor"
	"analytics/log"
	svmw "analytics/server/middlewares"
	"encoding/json"
	"fmt"
	"github.com/go-chi/chi/v5"
	"gorm.io/gorm"
	"net/http"
	"time"
)

func SetupPosthogRoutes(mux *chi.Mux) {
	mux.Group(func(mux chi.Router) {
		mux.Use(svmw.DecompressionMiddleware)
		mux.Post("/e/", EventHandler)
		mux.Post("/batch", BatchHandler)
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
	DistinctId string                 `json:"distinct_id"`
	Event      string                 `json:"event"`
	Properties map[string]interface{} `json:"properties"`
	Offset     *int                   `json:"offset"`
	Timestamp  string                 `json:"timestamp"`
}

type eventBatch struct {
	ApiKey string           `json:"api_key"`
	Batch  posthogEventList `json:"batch"`
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

	if e.DistinctId != "" {
		return token, e.DistinctId, true
	}

	distinctId, ok := e.Properties["distinct_id"].(string)
	if !ok || distinctId == "" {
		log.Info("No distinct_id found in event properties. Skipping event: %s", e.UUID)
		return "", "", false
	}

	return token, distinctId, true
}

func BatchHandler(w http.ResponseWriter, r *http.Request) {
	var batch eventBatch

	if err := json.NewDecoder(r.Body).Decode(&batch); err != nil {
		log.Error("Could not decode request body: %s", err)
		http.Error(w, "Unable to parse request body: "+err.Error(), http.StatusBadRequest)
		return
	}

	log.Info("Posthog batch received 1: %d", len(batch.Batch))
	for i := range batch.Batch {
		batch.Batch[i].Properties["token"] = batch.ApiKey
	}
	log.Info("Posthog batch received 2: %d", len(batch.Batch))

	appdb := svmw.GetAppDB(r)
	log.Info("Posthog batch received 3: %d", len(batch.Batch))
	queueEvents(appdb, batch.Batch)
	log.Info("Posthog batch received 4: %d", len(batch.Batch))

	w.WriteHeader(http.StatusOK)
	w.Write([]byte("Batch processed successfully"))
}

func EventHandler(w http.ResponseWriter, r *http.Request) {
	var ingestedEvents posthogEventList
	if err := json.NewDecoder(r.Body).Decode(&ingestedEvents); err != nil {
		http.Error(w, "Unable to parse request body: "+err.Error(), http.StatusBadRequest)
		return
	}

	appdb := svmw.GetAppDB(r)
	queueEvents(appdb, ingestedEvents)

	w.WriteHeader(http.StatusOK)
	w.Write([]byte("Events added to Queue"))
}

func queueEvents(appdb *gorm.DB, ingestedEvents posthogEventList) {

	log.Info("Received %d events", len(ingestedEvents))
	// Create a map to group event inputs by token.
	eventInputsByToken := make(map[string][]*events.EventInput)
	now := time.Now()
	for _, e := range ingestedEvents {
		eventTime := calculateEventTime(e, now)

		token, distinctId, valid := extractIdentifiers(e)
		if !valid {
			continue
		}

		eventInput := events.EventInput{
			EventType:  e.Event,
			DistinctId: distinctId,
			Timestamp:  eventTime,
			Properties: e.Properties,
		}
		eventInputsByToken[token] = append(eventInputsByToken[token], &eventInput)
	}

	for token, eventsByToken := range eventInputsByToken {
		projectId, err := apikeys.ValidateAPIKey(appdb, token)
		if err != nil {
			log.Error("Error while validating API key: %v. Skipping %d events.", err, len(eventsByToken))
			continue
		}
		processor.ProcessEvents(projectId, eventsByToken)
	}
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
