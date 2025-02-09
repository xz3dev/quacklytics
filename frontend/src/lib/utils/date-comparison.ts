/**
 * Finds the earliest date in an array of Date objects.
 * @param dates - Array of Date objects.
 * @returns The earliest Date object or null if the array is empty.
 */
export const findMinDate = (dates: Date[]): Date | null => {
    if (dates.length === 0) return null;
    return dates.reduce((min, date) => (date < min ? date : min), dates[0]);
};

/**
 * Finds the latest date in an array of Date objects.
 * @param dates - Array of Date objects.
 * @returns The latest Date object or null if the array is empty.
 */
export const findMaxDate = (dates: Date[]): Date | null => {
    if (dates.length === 0) return null;
    return dates.reduce((max, date) => (date > max ? date : max), dates[0]);
};


/**
 * Safely updates a date by comparing the current value with a new candidate.
 * @param current - The current date value in the store.
 * @param candidate - The new date candidate to compare.
 * @param comparator - A function that determines whether to update the current date.
 * @returns The updated date value.
 */
export const updateDate = (
    current: Date | null,
    candidate: Date | null,
    comparator: (a: Date, b: Date) => boolean
): Date | null => {
    if (!candidate) return current;
    if (!current) return candidate;
    return comparator(candidate, current) ? candidate : current;
};

