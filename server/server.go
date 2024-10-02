package server

import (
	"fmt"
	"log"
	"net/http"
)

const port = 3000

func Start() {
	server := http.Server{
		Addr:    fmt.Sprintf(":%d", port),
		Handler: setupRoutes(),
	}
	log.Printf("Starting server on port %d", port)
	server.ListenAndServe()
}
