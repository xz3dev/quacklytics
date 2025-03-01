package events

import (
	"analytics/database/analyticsdb"
	"analytics/database/appdb"
	"analytics/model"
	"fmt"
	"gorm.io/gorm"
	"sync"
)

type ProjectProcessor struct {
	projectID  string
	db         *gorm.DB
	dbd        analyticsdb.DuckDB
	eventQueue chan *model.EventInput
}

var (
	processors     = make(map[string]*ProjectProcessor)
	processorsLock sync.RWMutex
)

func GetOrCreateProcessor(projectID string) *ProjectProcessor {
	processorsLock.Lock()
	defer processorsLock.Unlock()

	if proc, exists := processors[projectID]; exists {
		return proc
	}

	db, ok := appdb.ProjectDBs[projectID]
	if !ok {
		panic(fmt.Sprintf("Project %s not found", projectID))
	}

	dbd, ok := analyticsdb.LookupTable[projectID]
	if !ok {
		panic(fmt.Sprintf("Project %s not found", projectID))
	}

	proc := &ProjectProcessor{
		projectID:  projectID,
		db:         db,
		dbd:        dbd,
		eventQueue: make(chan *model.EventInput, 1000),
	}

	go proc.processEventQueue()
	processors[projectID] = proc

	return proc
}
