package server

import (
	"fmt"
	"log"
	"net/http"
)

const port = 3000

func Start() {
	config := DefaultConfig()
	mux := http.NewServeMux()
	setupRoutes(mux)
	server := http.Server{
		Addr:    fmt.Sprintf(":%d", config.Port),
		Handler: setupCORS(config).Handler(mux),
	}

	log.Printf("Starting server on port %d", port)
	server.ListenAndServe()
}
