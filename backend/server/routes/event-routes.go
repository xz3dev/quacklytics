package routes

import (
	"analytics/actions"
	"analytics/events"
	"analytics/log"
	"analytics/model"
	"analytics/projects"
	"analytics/queries"
	sv_mw "analytics/server/middlewares"
	"analytics/util"
	"encoding/json"
	"fmt"
	"github.com/go-chi/chi/v5/middleware"
	"net/http"
	"os"
	"strconv"
	"strings"
	"time"
)

func AppendEvent(w http.ResponseWriter, r *http.Request) {
	w.Header().Set("Content-Type", "application/json")

	var event model.EventInput
	err := json.NewDecoder(r.Body).Decode(&event)
	if err != nil {
		w.WriteHeader(http.StatusBadRequest)
		log.Fatal(err.Error(), err)
		return
	}

	projectId := sv_mw.GetProjectID(r)
	events.ProcessEvent(projectId, &event)

	w.WriteHeader(http.StatusOK)
}

func QueryEvents(w http.ResponseWriter, r *http.Request) {
	w.Header().Set("Content-Type", "application/json")

	queryParams, err := queries.ExtractQueryParams(r)
	if err != nil {
		respondError(w, http.StatusBadRequest, "Invalid query parameters: "+err.Error())
		return
	}

	projectId := sv_mw.GetProjectID(r)

	events, err := actions.QueryEvents(projectId, queryParams)
	if err != nil {
		w.WriteHeader(http.StatusInternalServerError)
		log.Error("Error while querying events: %v", err)
		json.NewEncoder(w).Encode(map[string]string{"error": "Internal server error"})
		return
	}

	w.WriteHeader(http.StatusOK)
	json.NewEncoder(w).Encode(events)
}

func QueryEventAsParquet(w http.ResponseWriter, r *http.Request) {
	ctx := r.Context()
	requestId := middleware.GetReqID(ctx)
	parts := strings.Split(requestId, "/")
	shortRequestId := parts[len(parts)-1]

	projectId := sv_mw.GetProjectID(r)
	events, err := actions.QueryEvents(projectId, nil)
	if err != nil {
		w.WriteHeader(http.StatusInternalServerError)
		log.Error("Error while querying events: ", err)
		return
	}

	path := projects.TmpDir + "/"
	filename := shortRequestId + ".parquet"
	err = actions.ConvertEventsToParquet(events, path+filename)
	if err != nil {
		w.WriteHeader(http.StatusInternalServerError)
		log.Error("Error while converting events to Parquet: ", err)
		return
	}

	// Set headers for file download
	w.Header().Set("Content-Type", "application/octet-stream")
	w.Header().Set("Content-Disposition", "attachment; filename=\""+filename+"\"")
	w.WriteHeader(http.StatusOK)

	// Serve the file
	http.ServeFile(w, r, path+filename)
}

func GenerateDummyEvents(w http.ResponseWriter, r *http.Request) {
	w.Header().Set("Content-Type", "application/json")

	projectId := sv_mw.GetProjectID(r)

	actions.GenerateRandomEvents(projectId, 100, "test_type")
	//actions.GenerateRandomEvents(100, "test_type2")
	//actions.GenerateRandomEvents(100, "test_type3")
	//actions.GenerateRandomEvents(100, "test_type4")
	w.WriteHeader(http.StatusOK)
}

func EventsExport(w http.ResponseWriter, r *http.Request) {
	//db := sv_mw.GetProjectDB(r, w)
	//projectId := sv_mw.GetProjectID(r)

	//if err := actions.ExportToParquet(projectId, db); err != nil {
	//	log.Error(err.Error(), err)
	//	http.Error(w, err.Error(), http.StatusInternalServerError)
	//}
	// TODO: reimplement with time boundaries
	w.WriteHeader(http.StatusOK)
}

func QueryEventsKW(w http.ResponseWriter, r *http.Request) {
	projectId := sv_mw.GetProjectID(r)
	w.Header().Set("Content-Type", "application/json")

	kw, _ := strconv.Atoi(r.URL.Query().Get("kw"))
	year, _ := strconv.Atoi(r.URL.Query().Get("year"))
	if kw == 0 || year == 0 {
		respondError(w, http.StatusBadRequest, "kw and year query parameter are required.")
		return
	}

	eventType := r.URL.Query().Get("type")
	kwStart, kwEnd := util.GetWeekStartEnd(year, kw)
	weekCompleted := time.Now().After(kwEnd)

	path := projects.TmpDir + "/"
	filename := fmt.Sprintf("events_%s_kw%d_%d.parquet", projectId, kw, year)

	// Set headers for file download
	w.Header().Set("Content-Type", "application/octet-stream")
	w.Header().Set("Content-Disposition", "attachment; filename=\""+filename+"\"")

	if _, err := os.Stat(path + filename); err == nil && weekCompleted {
		log.Info("File %s exists, serving it.", filename)
		w.WriteHeader(http.StatusOK)
		http.ServeFile(w, r, path+filename)
		return
	}
	log.Info("File %s does not exist, creating it.", filename)

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

	log.Info("Start %s, End %s", kwStart, kwEnd)

	events, err := actions.QueryEvents(projectId, &queries.QueryParams{
		Conditions: conditions,
	})
	if err != nil {
		w.WriteHeader(http.StatusInternalServerError)
		log.Error("Error while querying events: %v", err)
		json.NewEncoder(w).Encode(map[string]string{"error": "Internal server error"})
		return
	}

	actions.ConvertEventsToParquet(events, path+filename)

	w.WriteHeader(http.StatusOK)

	// Serve the file
	http.ServeFile(w, r, path+filename)
}

func QueryEventsMonth(w http.ResponseWriter, r *http.Request) {
	projectId := sv_mw.GetProjectID(r)
	w.Header().Set("Content-Type", "application/json")

	// Parse month and year from query parameters
	month, err := strconv.Atoi(r.URL.Query().Get("month"))
	if err != nil || month < 1 || month > 12 {
		respondError(w, http.StatusBadRequest, "Valid month (1-12) and year query parameters are required.")
		return
	}

	year, err := strconv.Atoi(r.URL.Query().Get("year"))
	if err != nil || year < 1 {
		respondError(w, http.StatusBadRequest, "Valid year query parameter is required.")
		return
	}

	eventType := r.URL.Query().Get("type")

	// Get the start and end time of the specified month
	monthStart, monthEnd := util.GetMonthStartEnd(year, month)
	monthCompleted := time.Now().After(monthEnd)

	path := projects.TmpDir + "/"
	filename := fmt.Sprintf("events_%s_month%d_%d.parquet", projectId, month, year)

	// Set headers for file download
	w.Header().Set("Content-Type", "application/octet-stream")
	w.Header().Set("Content-Disposition", "attachment; filename=\""+filename+"\"")

	// Check if the file exists and the month is completed
	if _, err := os.Stat(path + filename); err == nil && monthCompleted {
		log.Info("File %s exists, serving it.", filename)
		w.WriteHeader(http.StatusOK)
		http.ServeFile(w, r, path+filename)
		return
	}
	log.Info("File %s does not exist or month not completed, creating it.", filename)

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
		Operation: queries.GreaterEquals,
		FieldType: queries.FieldTypes["timestamp"],
		Value:     monthStart,
	})
	conditions = append(conditions, queries.QueryCondition{
		Field:     "timestamp",
		Operation: queries.LessThan,
		FieldType: queries.FieldTypes["timestamp"],
		Value:     monthEnd,
	})

	log.Info("Start %s, End %s", monthStart.Format(time.RFC3339), monthEnd.Format(time.RFC3339))

	// Query events based on conditions
	events, err := actions.QueryEvents(projectId, &queries.QueryParams{
		Conditions: conditions,
	})
	if err != nil {
		w.WriteHeader(http.StatusInternalServerError)
		log.Error("Error while querying events: %v", err)
		json.NewEncoder(w).Encode(map[string]string{"error": "Internal server error"})
		return
	}

	// Convert events to Parquet format and save to file
	if err := actions.ConvertEventsToParquet(events, path+filename); err != nil {
		w.WriteHeader(http.StatusInternalServerError)
		log.Error("Error while converting events to Parquet: %v", err)
		json.NewEncoder(w).Encode(map[string]string{"error": "Internal server error"})
		return
	}

	w.WriteHeader(http.StatusOK)

	// Serve the generated file
	http.ServeFile(w, r, path+filename)
}

func LastTwelveWeeksChecksums(w http.ResponseWriter, r *http.Request) {
	projectId := sv_mw.GetProjectID(r)
	w.Header().Set("Content-Type", "application/json")

	checksums := make(map[string]string)
	currentDate := time.Now()
	currentYear, currentWeek := currentDate.ISOWeek()

	for i := 0; i < 12; i++ {
		week := currentWeek - i
		year := currentYear

		if week <= 0 {
			week += 52
			year--
		}

		filename := fmt.Sprintf("events_%s_kw%d_%d.parquet", projectId, week, year)
		filepath := fmt.Sprintf("%s/%s", projects.TmpDir, filename)

		checksum, err := util.CalculateFileChecksum(filepath)
		if err != nil || week == currentWeek {
			// If file doesn't exist or there's an error, set checksum to empty string
			checksums[filename] = ""
		} else {
			checksums[filename] = checksum
		}
	}

	w.WriteHeader(http.StatusOK)
	json.NewEncoder(w).Encode(map[string]interface{}{
		"checksums": checksums,
	})
}

func respondError(w http.ResponseWriter, statusCode int, message string) {
	w.WriteHeader(statusCode)
	json.NewEncoder(w).Encode(map[string]string{"error": message})
}

func LastTwelveMonthsChecksums(w http.ResponseWriter, r *http.Request) {
	projectId := sv_mw.GetProjectID(r)
	w.Header().Set("Content-Type", "application/json")

	checksums := make(map[string]string)
	currentDate := time.Now()
	currentYear, currentMonth := currentDate.Year(), int(currentDate.Month())

	for i := 0; i < 12; i++ {
		month := currentMonth - i
		year := currentYear

		if month <= 0 {
			month += 12
			year--
		}

		filename := fmt.Sprintf("events_%s_month%d_%d.parquet", projectId, month, year)
		filepath := fmt.Sprintf("%s/%s", projects.TmpDir, filename)

		// If the loop is at the current month, set checksum to empty string
		if month == currentMonth && year == currentYear {
			checksums[filename] = ""
			continue
		}

		checksum, err := util.CalculateFileChecksum(filepath)
		if err != nil {
			// If file doesn't exist or there's an error, set checksum to empty string
			checksums[filename] = ""
		} else {
			checksums[filename] = checksum
		}
	}

	w.WriteHeader(http.StatusOK)
	json.NewEncoder(w).Encode(map[string]interface{}{
		"checksums": checksums,
	})
}
