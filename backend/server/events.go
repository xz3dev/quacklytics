package server

import (
	"analytics/actions"
	"analytics/model"
	"analytics/parquet"
	"encoding/json"
	"github.com/go-chi/chi/v5/middleware"
	"log"
	"net/http"
	"strings"
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

func queryEventAsParquet(w http.ResponseWriter, r *http.Request) {
	requestId := middleware.GetReqID(r.Context())
	parts := strings.Split(requestId, "/")
	shortRequestId := parts[len(parts)-1]

	events, err := actions.QueryEvents(nil)
	if err != nil {
		w.WriteHeader(http.StatusInternalServerError)
		log.Println("Error while querying events: ", err)
		return
	}

	path := "_tmp/"
	filename := shortRequestId + ".parquet"
	err = parquet.ConvertEventsToParquet(events, path+filename)
	if err != nil {
		w.WriteHeader(http.StatusInternalServerError)
		log.Println("Error while converting events to Parquet: ", err)
		return
	}

	// Set headers for file download
	w.Header().Set("Content-Type", "application/octet-stream")
	w.Header().Set("Content-Disposition", "attachment; filename=\""+filename+"\"")
	w.WriteHeader(http.StatusOK)

	// Serve the file
	http.ServeFile(w, r, filename)
}

func generateDummyEvents(w http.ResponseWriter, r *http.Request) {
	w.Header().Set("Content-Type", "application/json")

	actions.GenerateRandomEvents(50, "test_type")
	w.WriteHeader(http.StatusOK)
}
