package schema

type EventSchema struct {
	ID         int                   `json:"id" gorm:"primary_key"`
	EventType  string                `json:"eventType" gorm:"index"`
	Properties []EventSchemaProperty `json:"properties" gorm:"foreignKey:EventSchemaID"`
}

type EventSchemaProperty struct {
	ID            int                        `json:"id" gorm:"primary_key"`
	EventSchemaID int                        `json:"eventSchemaId" gorm:"index"`
	Key           string                     `json:"key" gorm:"index"`
	Type          string                     `json:"type" gorm:"index"`
	Values        []EventSchemaPropertyValue `json:"values" gorm:"foreignKey:EventSchemaPropertyID"`
}

type EventSchemaPropertyValue struct {
	ID                    int    `json:"id" gorm:"primary_key"`
	EventSchemaPropertyID int    `json:"eventSchemaPropertyId" gorm:"index:uniqueVal,unique;index"`
	Value                 string `json:"value" gorm:"index:uniqueVal,unique"`
}
