package model

type InsightMeta struct {
	ID         uint   `gorm:"primarykey" json:"id"`
	InsightID  int    `json:"insightId" gorm:"index"`
	Duration   string `json:"duration" gorm:"size:511;not null"`
	TimeBucket string `json:"timeBucket" gorm:"size:255;not null"`
}
