package routes

import (
	"analytics/actions"
	sv_mw "analytics/server/middlewares"
	"github.com/go-chi/chi/v5"
	"net/http"
)

func SetupPersonsRoutes(mux chi.Router) {
	mux.Patch("/persons", fixupPersons)
}

func fixupPersons(w http.ResponseWriter, r *http.Request) {
	projectId := sv_mw.GetProjectID(r)
	projectDb := sv_mw.GetProjectDB(r, w)
	if err := actions.FixupPersons(projectId, projectDb); err != nil {
		http.Error(w, err.Error(), http.StatusInternalServerError)
		return
	}
	w.WriteHeader(http.StatusOK)
	w.Write([]byte("ok"))
}
