package routes

import (
	"analytics/domain/insights"
	"log"

	// Use the actual path to your insights package containing the Store and types
	sv_mw "analytics/server/middlewares"
	"encoding/json"
	"errors" // Import errors package for error checking
	"fmt"    // Import fmt for error formatting
	"io"
	"net/http"
	"strconv"

	"github.com/go-chi/chi/v5"
	"gorm.io/gorm" // Import gorm for error checking (ErrRecordNotFound)
)

func getInsightStore(w http.ResponseWriter, r *http.Request) insights.Store {
	db := sv_mw.GetProjectDB(r, w)      // Get *gorm.DB from context via middleware
	return insights.NewInsightStore(db) // Create and return a new store instance
}

func SetupInsightRoutes(mux chi.Router) {
	mux.Get("/insights", listInsights)
	mux.Post("/insights", createInsight)
	mux.Get("/insights/{id}", getInsight)
	mux.Put("/insights/{id}", updateInsight)
	mux.Delete("/insights/{id}", deleteInsight)
}

func getInsight(w http.ResponseWriter, r *http.Request) {
	idParam := chi.URLParam(r, "id")
	id64, err := strconv.ParseUint(idParam, 10, 32) // Parse to uint64 first
	if err != nil {
		http.Error(w, fmt.Sprintf("Invalid insight ID format: %s", idParam), http.StatusBadRequest)
		return
	}
	id := uint(id64) // Convert to uint

	store := getInsightStore(w, r) // Get store instance

	insight, err := store.GetInsightByID(id)
	if err != nil {
		// Check specifically for record not found error
		if errors.Is(err, gorm.ErrRecordNotFound) {
			http.Error(w, fmt.Sprintf("Insight with ID %d not found", id), http.StatusNotFound)
		} else {
			// Log the actual error for server-side debugging
			log.Printf("ERROR: Failed to get insight %d: %v", id, err)
			http.Error(w, "Internal server error", http.StatusInternalServerError)
		}
		return
	}

	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(http.StatusOK)
	if err := json.NewEncoder(w).Encode(insight); err != nil {
		// Log encoding error, though response likely already partially sent
		log.Printf("ERROR: Failed to encode insight %d: %v", id, err)
	}
}

func listInsights(w http.ResponseWriter, r *http.Request) {
	store := getInsightStore(w, r) // Get store instance

	insightsList, err := store.ListInsights()
	if err != nil {
		log.Printf("ERROR: Failed to list insights: %v", err)
		http.Error(w, "Internal server error", http.StatusInternalServerError)
		return
	}

	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(http.StatusOK)
	if err := json.NewEncoder(w).Encode(insightsList); err != nil {
		log.Printf("ERROR: Failed to encode insights list: %v", err)
	}
}

func createInsight(w http.ResponseWriter, r *http.Request) {
	var input insights.InsightInput // Use the correct input type from insights package
	if err := json.NewDecoder(r.Body).Decode(&input); err != nil {
		// Check for EOF specifically, can mean empty body
		if err == io.EOF {
			http.Error(w, "Request body cannot be empty", http.StatusBadRequest)
		} else {
			http.Error(w, fmt.Sprintf("Invalid request body: %v", err), http.StatusBadRequest)
		}
		return
	}
	defer r.Body.Close()

	store := getInsightStore(w, r) // Get store instance

	createdInsight, err := store.CreateInsight(&input)
	if err != nil {
		log.Printf("ERROR: Failed to create insight: %v", err)
		// Consider checking for specific validation errors if the store could return them
		http.Error(w, "Failed to create insight", http.StatusInternalServerError)
		return
	}

	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(http.StatusCreated) // Set 201 Created status
	if err := json.NewEncoder(w).Encode(createdInsight); err != nil {
		log.Printf("ERROR: Failed to encode created insight %d: %v", createdInsight.ID, err)
	}
}

func updateInsight(w http.ResponseWriter, r *http.Request) {
	idParam := chi.URLParam(r, "id")
	id64, err := strconv.ParseUint(idParam, 10, 32)
	if err != nil {
		http.Error(w, fmt.Sprintf("Invalid insight ID format: %s", idParam), http.StatusBadRequest)
		return
	}
	id := uint(id64)

	var input insights.InsightInput
	if err := json.NewDecoder(r.Body).Decode(&input); err != nil {
		if err == io.EOF {
			http.Error(w, "Request body cannot be empty", http.StatusBadRequest)
		} else {
			http.Error(w, fmt.Sprintf("Invalid request body: %v", err), http.StatusBadRequest)
		}
		return
	}
	defer r.Body.Close()

	// Optional: Add request body validation logic here

	store := getInsightStore(w, r) // Get store instance

	updatedInsight, err := store.UpdateInsight(id, &input)
	if err != nil {
		if errors.Is(err, gorm.ErrRecordNotFound) {
			http.Error(w, fmt.Sprintf("Insight with ID %d not found for update", id), http.StatusNotFound)
			// } else if strings.Contains(err.Error(), "validation error") { // Example: check for validation errors
			// 	http.Error(w, fmt.Sprintf("Validation failed: %v", err), http.StatusBadRequest)
		} else {
			log.Printf("ERROR: Failed to update insight %d: %v", id, err)
			http.Error(w, "Failed to update insight", http.StatusInternalServerError)
		}
		return
	}

	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(http.StatusOK)
	if err := json.NewEncoder(w).Encode(updatedInsight); err != nil {
		log.Printf("ERROR: Failed to encode updated insight %d: %v", id, err)
	}
}

func deleteInsight(w http.ResponseWriter, r *http.Request) {
	idParam := chi.URLParam(r, "id")
	id64, err := strconv.ParseUint(idParam, 10, 32)
	if err != nil {
		http.Error(w, fmt.Sprintf("Invalid insight ID format: %s", idParam), http.StatusBadRequest)
		return
	}
	id := uint(id64)

	store := getInsightStore(w, r) // Get store instance

	err = store.DeleteInsight(id)
	if err != nil {
		if errors.Is(err, gorm.ErrRecordNotFound) {
			// The store now returns ErrRecordNotFound if RowsAffected is 0
			http.Error(w, fmt.Sprintf("Insight with ID %d not found for deletion", id), http.StatusNotFound)
		} else {
			log.Printf("ERROR: Failed to delete insight %d: %v", id, err)
			http.Error(w, "Failed to delete insight", http.StatusInternalServerError)
		}
		return
	}

	w.WriteHeader(http.StatusNoContent) // Send 204 No Content on successful deletion
}
