package model

import (
	"database/sql/driver"
	"encoding/json"
	"gorm.io/gorm"
	"time"
)

type Base struct {
	ID        uint           `gorm:"primarykey" json:"id"`
	CreatedAt time.Time      `json:"createdAt"`
	UpdatedAt time.Time      `json:"updatedAt"`
	DeletedAt gorm.DeletedAt `gorm:"index" json:"deletedAt"`
}

type JSON json.RawMessage

func (q JSON) Value() (driver.Value, error) {
	return json.RawMessage(q).MarshalJSON()
}

func (q *JSON) Scan(value interface{}) error {
	return json.Unmarshal(value.([]byte), &q)
}
