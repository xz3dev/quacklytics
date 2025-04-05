package routes

import (
	"analytics/domain/apikeys"
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
	mux.Delete("/apikeys/{keyid}", deleteKey)
}

func deleteKey(w http.ResponseWriter, r *http.Request) {

	keyId, err := strconv.Atoi(chi.URLParam(r, "keyid"))
	if err != nil {
		http.Error(w, "Invalid key id", http.StatusBadRequest)
		return
	}
	appdb := svmw.GetAppDB(r)
	projectId := svmw.GetProjectID(r)

	err = deleteKeyFromDb(appdb, keyId, projectId)
	if err != nil {
		http.Error(w, "Failed to delete key", http.StatusInternalServerError)
		return
	}

	w.WriteHeader(http.StatusNoContent)
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

	appdb.Create(&apikeys.ApiKey{
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

func queryKey(db *gorm.DB, id int, projectId string) (*apikeys.ApiKey, error) {
	var key apikeys.ApiKey
	err := db.First(&key, "id = ? and project = ?", id, projectId).Error
	if err != nil {
		return nil, err
	}

	return &key, nil
}

func queryKeys(db *gorm.DB, projectId string) []apikeys.ApiKey {
	var keys []apikeys.ApiKey
	db.Find(&keys, "project = ?", projectId)
	for i := range keys {
		keys[i].Key = ""
	}

	return keys
}

func deleteKeyFromDb(db *gorm.DB, keyId int, projectId string) error {
	return db.Delete(&apikeys.ApiKey{}, "id = ? and project = ?", keyId, projectId).Error
}
