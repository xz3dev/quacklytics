package routes

import (
	"analytics/actions"
	sv_mw "analytics/server/middlewares"
	"github.com/go-chi/chi/v5"
	"net/http"
)

func SetupFixupRoute(mux chi.Router) {
	mux.Patch("/", fixupPeronsAndSchema)
}

func fixupPeronsAndSchema(w http.ResponseWriter, r *http.Request) {
	projectId := sv_mw.GetProjectID(r)
	if err := actions.FixupPersonsAndSchema(projectId); err != nil {
		http.Error(w, err.Error(), http.StatusInternalServerError)
		return
	}
	w.WriteHeader(http.StatusOK)
	w.Write([]byte("ok"))
}
