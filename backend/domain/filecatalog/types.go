package filecatalog

import (
	"gorm.io/gorm"
	"time"
)

type FileCatalogEntry struct {
	ID         uint           `gorm:"primarykey" json:"id"`
	Name       string         `gorm:"type:text;not null" json:"name"`
	Start      *time.Time     `json:"start" gorm:"not null"`
	End        *time.Time     `json:"end"`
	ValidUntil *time.Time     `json:"validUntil"`
	Checksum   string         `json:"checksum"`
	EventCount uint           `gorm:"type:uint;not null;default:0" json:"eventCount"`
	CreatedAt  time.Time      `json:"createdAt"`
	UpdatedAt  time.Time      `json:"updatedAt"`
	DeletedAt  gorm.DeletedAt `gorm:"index" json:"deletedAt"`
}

// DataSegment holds the time range and an example generated filename.
// You can extend this with checksums, etc.
type DataSegment struct {
	StartDate  time.Time
	EndDate    time.Time
	ValidUntil *time.Time
	Filename   string
}
