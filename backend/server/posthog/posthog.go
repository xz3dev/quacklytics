package posthog

import (
	"analytics/log"
	"analytics/model"
	svmw "analytics/server/middlewares"
	"encoding/json"
	"fmt"
	"github.com/go-chi/chi/v5"
	"github.com/google/uuid"
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

func EmptyOkResponse(writer http.ResponseWriter, request *http.Request) {
	writer.Header().Set("Content-Type", "application/json")
	writer.Write([]byte("{}"))
}

type posthogEvent struct {
	UUID       string                 `json:"uuid"`
	Event      string                 `json:"event"`
	Properties map[string]interface{} `json:"properties"`
	Offset     *int                   `json:"offset"`
	Timestamp  string                 `json:"timestamp"`
}

type posthogEventList []posthogEvent

func PosthogHandler(w http.ResponseWriter, r *http.Request) {
	var events posthogEventList

	if err := json.NewDecoder(r.Body).Decode(&events); err != nil {
		http.Error(w, "Unable to parse request body: "+err.Error(), http.StatusBadRequest)
		return
	}

	// Create a map to group event inputs by token.
	eventInputsByToken := make(map[string][]model.EventInput)
	now := time.Now()

	for _, event := range events {
		eventTime := now

		if event.Offset != nil {
			eventTime = eventTime.Add(time.Duration(*event.Offset) * time.Millisecond)
		}
		if event.Timestamp != "" {
			parsedTime, err := time.Parse(time.RFC3339, event.Timestamp)
			if err == nil && !parsedTime.IsZero() {
				eventTime = parsedTime
			}
		}

		// Extract token from properties. Use a default value if token is not present or is not a string.
		token, ok := event.Properties["token"].(string)
		if !ok || token == "" {
			log.Info("No token found in event properties. Skipping event: %s", event.UUID)
			// no token = skip
			continue
		}
		_, ok = event.Properties["distinct_id"].(string)
		if !ok {
			log.Info("No distinct_id found in event properties. Skipping event: %s", event.UUID)
			// no distinct_id = skip
			continue
		}

		eventInput := model.EventInput{
			EventType:  event.Event,
			PersonId:   uuid.UUID{}, // Adjust this as appropriate for your logic.
			DistinctId: event.Properties["distinct_id"].(string),
			Timestamp:  eventTime,
			Properties: event.Properties,
		}

		// Append the event input to the slice corresponding to the token.
		eventInputsByToken[token] = append(eventInputsByToken[token], eventInput)
	}

	// Continue processing eventInputsByToken as needed.
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
