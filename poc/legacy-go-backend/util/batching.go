package util

func ProcessBatched[T any](slice *[]T, batchSize int, processFunc func(batch []T)) {
	if slice == nil {
		panic("slice cannot be nil")
	}
	if batchSize <= 0 {
		panic("batch size must be greater than 0")
	}

	data := *slice
	for i := 0; i < len(data); i += batchSize {
		end := i + batchSize
		if end > len(data) {
			end = len(data)
		}
		// Execute the provided function for the current batch
		processFunc(data[i:end])
	}
}
