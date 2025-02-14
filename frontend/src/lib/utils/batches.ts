export async function processInBatches<T>(
    items: T[],
    batchSize: number,
    lambda: (batch: T[]) => Promise<void>,
): Promise<void> {
    for (let i = 0; i < items.length; i += batchSize) {
        const batch = items.slice(i, i + batchSize);
        try {
            await lambda(batch);
        } catch (error) {
            console.error(`Error processing batch starting at index ${i}:`, error);
        }
    }
}
