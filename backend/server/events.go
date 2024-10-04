package server

import (
	"analytics/actions"
	"analytics/model"
	"encoding/json"
	"log"
	"net/http"
)

func receiveEvent(w http.ResponseWriter, r *http.Request) {
	w.Header().Set("Content-Type", "application/json")

	var event model.EventInput
	err := json.NewDecoder(r.Body).Decode(&event)
	if err != nil {
		w.WriteHeader(http.StatusBadRequest)
		log.Fatal(err)
		return
	}
	actions.ProcessEvent(&event)

	w.WriteHeader(http.StatusOK)
}

func queryEvents(w http.ResponseWriter, r *http.Request) {
	w.Header().Set("Content-Type", "application/json")

	events, err := actions.QueryEvents()
	if err != nil {
		w.WriteHeader(http.StatusInternalServerError)
		log.Fatal("Error while querying events: ", err)
		return
	}
	jsonEvents, err := json.Marshal(events)
	if err != nil {
		w.WriteHeader(http.StatusInternalServerError)
		log.Fatal("Error while unmarshaling events", err)
		return
	}
	w.Write(jsonEvents)
	w.WriteHeader(http.StatusOK)
}

func generateDummyEvents(w http.ResponseWriter, r *http.Request) {
	w.Header().Set("Content-Type", "application/json")

	actions.GenerateRandomEvents(2000, "test_type")
	w.WriteHeader(http.StatusOK)
}
