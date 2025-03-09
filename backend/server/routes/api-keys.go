package routes

import (
	"analytics/model"
	svmw "analytics/server/middlewares"
	"analytics/util"
	"encoding/json"
	"fmt"
	"github.com/go-chi/chi/v5"
	"gorm.io/gorm"
	"net/http"
	"strconv"
)

func SetupAPIKeysRoutes(mux chi.Router) {
	mux.Post("/apikeys", createKey)
	mux.Get("/apikeys", getKeys)
	mux.Get("/apikeys/{keyid}", getKey)
}

func getKeys(w http.ResponseWriter, r *http.Request) {
	projectId := svmw.GetProjectID(r)
	appdb := svmw.GetAppDB(r)

	keys := queryKeys(appdb, projectId)

	w.WriteHeader(http.StatusOK)
	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(keys)
}

func createKey(w http.ResponseWriter, r *http.Request) {
	projectId := svmw.GetProjectID(r)
	appdb := svmw.GetAppDB(r)

	appdb.Create(&model.ApiKey{
		Key:     fmt.Sprintf("ds_%s_%s", projectId, util.RandSeq(20)),
		Project: projectId,
	})

	keys := queryKeys(appdb, projectId)
	w.WriteHeader(http.StatusOK)
	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(keys)
}

func getKey(w http.ResponseWriter, r *http.Request) {
	keyId, err := strconv.Atoi(chi.URLParam(r, "keyid"))
	if err != nil {
		http.Error(w, "Invalid key id", http.StatusBadRequest)
		return
	}
	appdb := svmw.GetAppDB(r)
	projectId := svmw.GetProjectID(r)

	key, err := queryKey(appdb, keyId, projectId)
	if err != nil {
		http.Error(w, "Unknown key id", http.StatusNotFound)
		return
	}

	w.WriteHeader(http.StatusOK)
	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(key)
}

func queryKey(db *gorm.DB, id int, projectId string) (*model.ApiKey, error) {
	var key model.ApiKey
	err := db.First(&key, "id = ? and project = ?", id, projectId).Error
	if err != nil {
		return nil, err
	}

	return &key, nil
}

func queryKeys(db *gorm.DB, projectId string) []model.ApiKey {
	var keys []model.ApiKey
	db.Find(&keys, "project = ?", projectId)
	for i := range keys {
		keys[i].Key = ""
	}

	return keys
}
