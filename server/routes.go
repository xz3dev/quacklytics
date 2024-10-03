package server

import "net/http"

func setupRoutes() *http.ServeMux {
	mux := http.NewServeMux()
	mux.HandleFunc("POST /event", receiveEvent)
	mux.HandleFunc("POST /dummy", generateDummyEvents)

	return mux
}
