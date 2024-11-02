package schema

type EventSchema struct {
	ID         int                   `json:"id" gorm:"primary_key"`
	EventType  string                `json:"eventType" gorm:"index"`
	Properties []EventSchemaProperty `json:"properties"`
}

type EventSchemaProperty struct {
	EventSchemaID int    `json:"eventSchemaId" gorm:"primary_key;index"`
	Key           string `json:"key" gorm:"primary_key;index"`
	Type          string `json:"type"`
}
