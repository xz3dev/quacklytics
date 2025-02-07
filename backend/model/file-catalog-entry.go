package model

import "time"

type FileCatalogEntry struct {
	Name       string     `gorm:"type:varchar(512);primary_key;;not null" json:"name"`
	Start      *time.Time `json:"start" gorm:"not null"`
	End        *time.Time `json:"end"`
	ValidUntil *time.Time `json:"validUntil"`
	Checksum   string     `json:"checksum"`
}

// DataSegment holds the time range and an example generated filename.
// You can extend this with checksums, etc.
type DataSegment struct {
	StartDate  time.Time
	EndDate    time.Time
	ValidUntil *time.Time
	Filename   string
}
