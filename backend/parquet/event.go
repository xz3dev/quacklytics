package parquet

type EventRecord struct {
	ID [16]byte `parquet:"name=id, type=FIXED_LEN_BYTE_ARRAY, length=16"`
	//ID        string `parquet:"name=id, type=BYTE_ARRAY, convertedtype=UTF8, encoding=DELTA_BYTE_ARRAY"`
	EventType string `parquet:"name=eventType, type=BYTE_ARRAY, convertedtype=UTF8, encoding=DELTA_BYTE_ARRAY"`
	//UserId    string `parquet:"name=userId, type=BYTE_ARRAY, convertedtype=UTF8, encoding=DELTA_BYTE_ARRAY"`
	UserId     [16]byte `parquet:"name=userId, type=FIXED_LEN_BYTE_ARRAY, length=16"`
	Timestamp  int64    `parquet:"name=timestamp, type=INT64, convertedtype=TIMESTAMP_MILLIS, encoding=DELTA_BINARY_PACKED"`
	Properties string   `parquet:"name=properties, type=BYTE_ARRAY, convertedtype=UTF8, encoding=DELTA_BYTE_ARRAY"`
}
