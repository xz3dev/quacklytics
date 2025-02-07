package model

import "time"

type FileCatalogEntry struct {
	Name       string     `gorm:"type:varchar(512);primary_key;;not null" json:"name"`
	Start      *time.Time `json:"start" gorm:"not null"`
	End        *time.Time `json:"end"`
	ValidUntil *time.Time `json:"validUntil"`
	Checksum   string     `json:"checksum"`
}
