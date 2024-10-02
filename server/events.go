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

	var event model.Event
	err := json.NewDecoder(r.Body).Decode(&event)
	if err != nil {
		w.WriteHeader(http.StatusBadRequest)
		log.Fatal(err)
		return
	}
	actions.ProcessEvent(&event)
	w.WriteHeader(http.StatusOK)

}
