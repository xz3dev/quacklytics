package routes

import (
	"analytics/filecatalog"
	svmw "analytics/server/middlewares"
	"encoding/json"
	"net/http"
)

func FileChecksums(w http.ResponseWriter, r *http.Request) {
	db := svmw.GetProjectDB(r, w)
	files, err := filecatalog.ListAll(db)
	if err != nil {
		http.Error(w, err.Error(), http.StatusInternalServerError)
	}

	w.WriteHeader(http.StatusOK)
	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(files)
}

func RegenerateFiles(w http.ResponseWriter, r *http.Request) {
	db := svmw.GetProjectDB(r, w)
	projectId := svmw.GetProjectID(r)
	err := filecatalog.GenerateParquetFiles(projectId, db)
	if err != nil {
		http.Error(w, err.Error(), http.StatusInternalServerError)
	}
	w.WriteHeader(http.StatusOK)
}
