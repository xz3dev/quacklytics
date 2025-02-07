package routes

import (
	"analytics/filecatalog"
	"analytics/log"
	"analytics/model"
	"analytics/projects"
	svmw "analytics/server/middlewares"
	"encoding/json"
	"net/http"
	"net/url"
	"os"
	"path/filepath"
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

func FileDownload(w http.ResponseWriter, r *http.Request) {
	db := svmw.GetProjectDB(r, w)
	filename := r.URL.Query().Get("file")

	var fileEntry model.FileCatalogEntry
	db.First(&fileEntry, filename)

	projectId := svmw.GetProjectID(r)

	filepath := filepath.Join(projects.TmpDir, projectId, filecatalog.ParquetDir, filename)

	if _, err := os.Stat(filepath); err == nil {
		log.Info("File %s exists, serving it.", filename)
		encodedFilename := url.PathEscape(filename)
		w.WriteHeader(http.StatusOK)
		w.Header().Set("Content-Type", "application/octet-stream")
		w.Header().Set("Content-Disposition", "attachment; filename=\""+encodedFilename+"\"")
		http.ServeFile(w, r, filepath)
		return
	}
	http.Error(w, "File not found.", http.StatusNotFound)
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
