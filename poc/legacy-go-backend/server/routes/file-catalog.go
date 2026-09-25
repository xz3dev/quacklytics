package routes

import (
	"analytics/config"
	"analytics/domain/events/parquet"
	"analytics/domain/filecatalog"
	"analytics/domain/projects"
	"analytics/log"
	svmw "analytics/server/middlewares"
	"encoding/json"
	"github.com/go-chi/chi/v5"
	"net/http"
	"net/url"
	"os"
	"path"
	"path/filepath"
	"strconv"
	"time"
)

func SetupFileCatalogRoutes(mux chi.Router) {
	mux.Get("/events/catalog", FileChecksums)
	mux.Get("/events/catalog/gen", RegenerateFiles)
	mux.Get("/events/download", FileDownload)
}

type FileCatalogEntryResponse struct {
	filecatalog.FileCatalogEntry
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

	settings, err := projects.QuerySettings(projectId, db)
	if err != nil {
		http.Error(w, "cannot query project settings", http.StatusInternalServerError)
		return
	}

	autoLoadMonths, _ := strconv.Atoi(settings[projects.AutoLoadRange])
	if autoLoadMonths <= 0 {
		autoLoadMonths = 6
	}

	sixMonthAgo := time.Now().AddDate(0, -autoLoadMonths, 0)

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

	var fileEntry filecatalog.FileCatalogEntry
	err := db.Find(&fileEntry, "name = ?", filename).Error
	if err != nil {
		log.Error("Error while querying file %s: %v", filename, err)
		http.Error(w, err.Error(), http.StatusInternalServerError)
		return
	}

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
	parquet.GenerateParquetFiles(projectId, db)
	w.WriteHeader(http.StatusOK)
}
