package events

import (
	"analytics/model"
	"gorm.io/gorm"
	"sync"
)

type ProjectProcessor struct {
	projectID  string
	db         *gorm.DB
	eventQueue chan *model.EventInput
}

var (
	processors     = make(map[string]*ProjectProcessor)
	processorsLock sync.RWMutex
)

func GetOrCreateProcessor(projectID string, db *gorm.DB) *ProjectProcessor {
	processorsLock.Lock()
	defer processorsLock.Unlock()

	if proc, exists := processors[projectID]; exists {
		return proc
	}

	proc := &ProjectProcessor{
		projectID:  projectID,
		db:         db,
		eventQueue: make(chan *model.EventInput, 1000),
	}

	go proc.processEventQueue()
	processors[projectID] = proc

	return proc
}
