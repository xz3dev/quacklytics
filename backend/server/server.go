package server

import (
	"fmt"
	"log"
	"net/http"
)

const port = 3000

func Start() {
	config := DefaultConfig()
	server := http.Server{
		Addr:    fmt.Sprintf(":%d", config.Port),
		Handler: setupMux(config),
	}

	log.Printf("Starting server on port %d", port)
	server.ListenAndServe()
}
