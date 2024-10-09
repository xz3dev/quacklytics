package actions

import (
	"analytics/model"
	"encoding/json"
	"github.com/apache/arrow/go/v17/arrow"
	"github.com/apache/arrow/go/v17/arrow/array"
	"github.com/apache/arrow/go/v17/arrow/memory"
	"github.com/apache/arrow/go/v17/parquet"
	"github.com/apache/arrow/go/v17/parquet/pqarrow"
	"os"
)

func convertToArrowRecord(events []model.Event) arrow.Record {
	// Create memory allocator
	pool := memory.NewGoAllocator()
	numEvents := len(events)

	// Create builders for each field
	idBuilder := array.NewFixedSizeBinaryBuilder(pool, &arrow.FixedSizeBinaryType{ByteWidth: 16})
	eventTypeBuilder := array.NewStringBuilder(pool)
	userIdBuilder := array.NewFixedSizeBinaryBuilder(pool, &arrow.FixedSizeBinaryType{ByteWidth: 16})
	timestampBuilder := array.NewTimestampBuilder(pool, &arrow.TimestampType{Unit: arrow.Millisecond})
	propertiesBuilder := array.NewStringBuilder(pool)

	// Populate the builders
	for _, event := range events {
		idBuilder.Append(event.Id[:])
		eventTypeBuilder.Append(event.EventType)
		userIdBuilder.Append(event.UserId[:])
		timestampBuilder.Append(arrow.Timestamp(event.Timestamp.UnixMilli()))
		propertiesJSON, _ := json.Marshal(event.Properties)
		propertiesBuilder.Append(string(propertiesJSON))
	}

	// Create arrays from builders
	idArray := idBuilder.NewArray()
	eventTypeArray := eventTypeBuilder.NewArray()
	userIdArray := userIdBuilder.NewArray()
	timestampArray := timestampBuilder.NewArray()
	propertiesArray := propertiesBuilder.NewArray()

	// Create schema
	schema := arrow.NewSchema(
		[]arrow.Field{
			{Name: "id", Type: &arrow.FixedSizeBinaryType{ByteWidth: 16}},
			{Name: "eventType", Type: arrow.BinaryTypes.String},
			{Name: "userId", Type: &arrow.FixedSizeBinaryType{ByteWidth: 16}},
			{Name: "timestamp", Type: &arrow.TimestampType{Unit: arrow.Millisecond}},
			{Name: "properties", Type: arrow.BinaryTypes.String},
		},
		nil,
	)

	// Create record
	record := array.NewRecord(schema, []arrow.Array{
		idArray, eventTypeArray, userIdArray, timestampArray, propertiesArray,
	}, int64(numEvents))
	return record
}

func ConvertEventsToParquet(events *[]model.Event, filename string) error {
	// Convert events to Arrow record
	record := convertToArrowRecord(*events)
	defer record.Release()

	// Create Parquet file
	file, err := os.Create(filename)
	if err != nil {
		return err
	}
	defer file.Close()

	// Create Parquet writer
	writerProps := parquet.NewWriterProperties(
		parquet.WithCompression(1),
		parquet.WithDictionaryDefault(false),
	)
	arrowWriterProps := pqarrow.NewArrowWriterProperties(pqarrow.WithStoreSchema())
	writer, err := pqarrow.NewFileWriter(
		record.Schema(),
		file,
		writerProps,
		arrowWriterProps,
	)
	if err != nil {
		return err
	}

	// Write record to Parquet file
	if err := writer.Write(record); err != nil {
		return err
	}

	// Close the writer
	if err := writer.Close(); err != nil {
		return err
	}
	return nil
}
