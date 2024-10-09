package server

import (
	"analytics/actions"
	"analytics/model"
	"analytics/parquet"
	"analytics/queries"
	"encoding/json"
	"fmt"
	"github.com/go-chi/chi/v5/middleware"
	"log"
	"net/http"
	"os"
	"strconv"
	"strings"
	"time"
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

	queryParams, err := queries.ExtractQueryParams(r)
	if err != nil {
		respondError(w, http.StatusBadRequest, "Invalid query parameters: "+err.Error())
		return
	}

	events, err := actions.QueryEvents(queryParams)
	if err != nil {
		w.WriteHeader(http.StatusInternalServerError)
		log.Printf("Error while querying events: %v", err)
		json.NewEncoder(w).Encode(map[string]string{"error": "Internal server error"})
		return
	}

	w.WriteHeader(http.StatusOK)
	json.NewEncoder(w).Encode(events)
}

func queryEventAsParquet(w http.ResponseWriter, r *http.Request) {
	ctx := r.Context()
	requestId := middleware.GetReqID(ctx)
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
	http.ServeFile(w, r, path+filename)
}

func generateDummyEvents(w http.ResponseWriter, r *http.Request) {
	w.Header().Set("Content-Type", "application/json")

	actions.GenerateRandomEvents(50, "test_type")
	w.WriteHeader(http.StatusOK)
}

func queryEventsKW(w http.ResponseWriter, r *http.Request) {
	w.Header().Set("Content-Type", "application/json")

	kw, _ := strconv.Atoi(r.URL.Query().Get("kw"))
	year, _ := strconv.Atoi(r.URL.Query().Get("year"))
	if kw == 0 || year == 0 {
		respondError(w, http.StatusBadRequest, "kw and year query parameter are required.")
		return
	}

	eventType := r.URL.Query().Get("type")
	kwStart, kwEnd := getWeekStartEnd(year, kw)
	weekCompleted := time.Now().After(kwEnd)

	path := "_tmp/"
	filename := fmt.Sprintf("events_kw%d_%d.parquet", kw, year)

	// Set headers for file download
	w.Header().Set("Content-Type", "application/octet-stream")
	w.Header().Set("Content-Disposition", "attachment; filename=\""+filename+"\"")

	if _, err := os.Stat(path + filename); err == nil && weekCompleted {
		log.Printf("File %s exists, serving it", filename)
		w.WriteHeader(http.StatusOK)
		http.ServeFile(w, r, path+filename)
		return
	}

	var conditions []queries.QueryCondition
	if len(eventType) > 0 {
		conditions = append(conditions, queries.QueryCondition{
			Field:     "event_type",
			Operation: queries.Equals,
			FieldType: queries.FieldTypes["event_type"],
			Value:     eventType,
		})
	}

	conditions = append(conditions, queries.QueryCondition{
		Field:     "timestamp",
		Operation: queries.GreaterThan,
		FieldType: queries.FieldTypes["timestamp"],
		Value:     kwStart,
	})
	conditions = append(conditions, queries.QueryCondition{
		Field:     "timestamp",
		Operation: queries.LessThan,
		FieldType: queries.FieldTypes["timestamp"],
		Value:     kwEnd,
	})

	log.Printf("Start %s, End %s", kwStart, kwEnd)

	events, err := actions.QueryEvents(&queries.QueryParams{
		Conditions: conditions,
	})
	if err != nil {
		w.WriteHeader(http.StatusInternalServerError)
		log.Printf("Error while querying events: %v", err)
		json.NewEncoder(w).Encode(map[string]string{"error": "Internal server error"})
		return
	}

	parquet.ConvertEventsToParquet(events, path+filename)

	w.WriteHeader(http.StatusOK)

	// Serve the file
	http.ServeFile(w, r, path+filename)
}

func getWeekStartEnd(year int, week int) (time.Time, time.Time) {
	// Find the first day of the year
	firstDay := time.Date(year, 1, 1, 0, 0, 0, 0, time.UTC)

	// Find the first day of the week (Monday)
	offset := int(time.Monday - firstDay.Weekday())
	if offset > 0 {
		offset -= 7
	}
	weekStart := firstDay.AddDate(0, 0, offset+(week-1)*7)

	// The end of the week is 6 days after the start (Sunday)
	weekEnd := weekStart.AddDate(0, 0, 6).Add(24*time.Hour - 1*time.Microsecond)

	return weekStart, weekEnd
}

func respondError(w http.ResponseWriter, statusCode int, message string) {
	w.WriteHeader(statusCode)
	json.NewEncoder(w).Encode(map[string]string{"error": message})
}
