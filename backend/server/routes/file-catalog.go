package routes

import (
	"analytics/config"
	"analytics/filecatalog"
	"analytics/log"
	"analytics/model"
	svmw "analytics/server/middlewares"
	"encoding/json"
	"github.com/go-chi/chi/v5"
	"net/http"
	"net/url"
	"os"
	"path"
	"path/filepath"
	"time"
)

func SetupFileCatalogRoutes(mux chi.Router) {
	mux.Get("/events/catalog", FileChecksums)
	mux.Get("/events/catalog/gen", RegenerateFiles)
	mux.Get("/events/download", FileDownload)
}

type FileCatalogEntryResponse struct {
	model.FileCatalogEntry
	AutoLoad bool  `json:"autoload"`
	FileSize int64 `json:"filesize"`
}

func FileChecksums(w http.ResponseWriter, r *http.Request) {
	db := svmw.GetProjectDB(r, w)
	projectId := svmw.GetProjectID(r)
	files, err := filecatalog.ListAll(db)
	if err != nil {
		http.Error(w, err.Error(), http.StatusInternalServerError)
	}

	w.WriteHeader(http.StatusOK)
	w.Header().Set("Content-Type", "application/json")

	sixMonthAgo := time.Now().AddDate(0, -6, 0)

	result := make([]FileCatalogEntryResponse, len(files))
	dir := path.Join(config.Config.Paths.Parquet, projectId)
	for i, file := range files {
		stat, err := os.Stat(path.Join(dir, file.Name))
		if err != nil {
			log.Error("Error while reading file %s: %v", file.Name, err)
			continue
		}
		result[i] = FileCatalogEntryResponse{
			FileCatalogEntry: file,
			AutoLoad:         file.Start.After(sixMonthAgo),
			FileSize:         stat.Size(),
		}
	}

	json.NewEncoder(w).Encode(result)
}

func FileDownload(w http.ResponseWriter, r *http.Request) {
	db := svmw.GetProjectDB(r, w)
	filename := r.URL.Query().Get("file")

	var fileEntry model.FileCatalogEntry
	db.First(&fileEntry, filename)

	projectId := svmw.GetProjectID(r)

	filepath := filepath.Join(config.Config.Paths.Parquet, projectId, filename)

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
