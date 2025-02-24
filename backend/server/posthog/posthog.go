package posthog

import (
	"analytics/log"
	"analytics/model"
	"compress/gzip"
	"encoding/json"
	"fmt"
	"github.com/go-chi/chi/v5"
	"github.com/google/uuid"
	"io"
	"net/http"
	"time"
)

func SetupPosthogRoutes(mux *chi.Mux) {
	mux.Post("/e/", PosthogHandler)
	mux.Post("/decide/", EmptyOkResponse)
	mux.Get("/array/{apikey}/config.js", EmptyOkResponse)
	mux.Get("/array/{apikey}/config", EmptyOkResponse)
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

	compression := r.URL.Query().Get("compression")
	if compression == "gzip-js" {
		gzipReader, err := gzip.NewReader(r.Body)
		if err != nil {
			http.Error(w, "Unable to create gzip reader", http.StatusBadRequest)
			return
		}
		defer gzipReader.Close()

		bodyBytes, err := io.ReadAll(gzipReader)
		if err != nil {
			http.Error(w, "Unable to read gzip-compressed request body: "+err.Error(), http.StatusBadRequest)
			return
		}

		bodyString := string(bodyBytes)

		if err := json.Unmarshal([]byte(bodyString), &events); err != nil {
			log.Warn(err.Error())
			http.Error(w, "Unable to parse gzip-compressed request body: "+err.Error(), http.StatusBadRequest)
			return
		}
	} else {
		if err := json.NewDecoder(r.Body).Decode(&events); err != nil {
			http.Error(w, "Unable to parse request body: "+err.Error(), http.StatusBadRequest)
			return
		}
	}

	eventInputs := make([]model.EventInput, len(events))
	now := time.Now()
	for i, event := range events {
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
		eventInputs[i] = model.EventInput{
			EventType:  event.Event,
			PersonId:   uuid.UUID{},
			DistinctId: event.Properties["distinct_id"].(string),
			Timestamp:  eventTime,
			Properties: event.Properties,
		}
		// Processing logic for each event in your desired format
		_ = event
	}

	w.WriteHeader(http.StatusOK)
	w.Write([]byte("Events processed successfully"))
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
