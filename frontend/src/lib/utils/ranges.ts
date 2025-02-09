// Define a closed range interface.
export interface ClosedRange<T> {
    start: T;
    endInclusive: T;
}

// Helper functions for comparison.
// (These assume T is a type that supports < and >, e.g. number or string.)
function min<T>(a: T, b: T): T {
    return a < b ? a : b;
}

function max<T>(a: T, b: T): T {
    return a > b ? a : b;
}

// A closed range is considered empty if its start is greater than its end.
function isRangeEmpty<T>(range: ClosedRange<T>): boolean {
    return range.start > range.endInclusive;
}

/**
 * Represents a set of non-overlapping, non-empty closed ranges that together form one discontinuous range.
 * The array of ranges **must** be already sorted in ascending order and contain no overlaps.
 */
export class DiscontinuousRange<T> {
    public readonly ranges: Array<ClosedRange<T>>;

    constructor(ranges: Array<ClosedRange<T>>) {
        // Ensure no range is empty.
        if (ranges.some((r) => isRangeEmpty(r))) {
            throw new Error("Ranges can not be empty");
        }
        // Ensure the ranges do not overlap.
        for (let i = 0; i < ranges.length - 1; i++) {
            const first = ranges[i];
            const second = ranges[i + 1];
            if (!(first.endInclusive < second.start)) {
                throw new Error("Ranges can not overlap");
            }
        }
        this.ranges = ranges;
    }

    /** Returns true if there are no ranges. */
    isEmpty(): boolean {
        return this.ranges.length === 0;
    }

    /** Returns true if there is at least one range. */
    isNotEmpty(): boolean {
        return !this.isEmpty();
    }

    /**
     * Returns a new DiscontinuousRange with the given [range] merged in.
     * (This is analogous to Kotlin’s operator+.)
     */
    public plus(range: ClosedRange<T>): DiscontinuousRange<T> {
        // If there are no ranges, simply return one containing the new range.
        if (this.ranges.length === 0) {
            return new DiscontinuousRange([range]);
        }

        const merged: ClosedRange<T>[] = [];
        // Use the standard “merge intervals” algorithm.
        let newInterval = range;
        let inserted = false;

        for (const interval of this.ranges) {
            // Current interval lies completely before the new one.
            if (interval.endInclusive < newInterval.start) {
                merged.push(interval);
            }
            // Current interval lies completely after the new one.
            else if (interval.start > newInterval.endInclusive) {
                if (!inserted) {
                    merged.push(newInterval);
                    inserted = true;
                }
                merged.push(interval);
            }
            // They overlap; merge them.
            else {
                newInterval = {
                    start: min(interval.start, newInterval.start),
                    endInclusive: max(interval.endInclusive, newInterval.endInclusive),
                };
            }
        }

        if (!inserted) {
            merged.push(newInterval);
        }
        return new DiscontinuousRange(merged);
    }

    /**
     * Returns a new DiscontinuousRange that contains all ranges covered by either [this] or [other].
     */
    public union(other: DiscontinuousRange<T>): DiscontinuousRange<T> {
        if (other.isEmpty()) {
            return this;
        }
        if (this.isEmpty()) {
            return other;
        }
        let result: DiscontinuousRange<T> = this;
        for (const range of other.ranges) {
            result = result.plus(range);
        }
        return result;
    }

    /**
     * Returns a new DiscontinuousRange that contains only the intersections of the ranges in [this] and [other].
     */
    public intersect(other: DiscontinuousRange<T>): DiscontinuousRange<T> {
        if (this.isEmpty() || other.isEmpty()) {
            return new DiscontinuousRange<T>([]);
        }
        const intersections: ClosedRange<T>[] = [];
        let i = 0;
        let j = 0;

        // Use a standard two–pointer algorithm for intersecting sorted intervals.
        while (i < this.ranges.length && j < other.ranges.length) {
            const r1 = this.ranges[i];
            const r2 = other.ranges[j];
            const start = max(r1.start, r2.start);
            const end = min(r1.endInclusive, r2.endInclusive);
            if (start <= end) {
                intersections.push({ start, endInclusive: end });
            }
            // Move the pointer for the interval that ends first.
            if (r1.endInclusive < r2.endInclusive) {
                i++;
            } else {
                j++;
            }
        }
        return new DiscontinuousRange(intersections);
    }

    /**
     * Convenience method to intersect with a single closed range.
     */
    public intersectWithClosedRange(other: ClosedRange<T>): DiscontinuousRange<T> {
        return this.intersect(new DiscontinuousRange([other]));
    }
}

/** Returns an empty discontinuous range. */
export function discRangeOf<T>(): DiscontinuousRange<T> {
    return new DiscontinuousRange<T>([]);
}

/** Returns a discontinuous range constructed from the given closed ranges. */
export function discRangeOfRanges<T>(...ranges: ClosedRange<T>[]): DiscontinuousRange<T> {
    return new DiscontinuousRange<T>(ranges);
}

/**
 * Builds a discontinuous range from a list of events.
 *
 * Assumes the events are sorted in ascending order by their value.
 *
 * - `isEnd` determines whether an event marks the end of a range.
 * - `getValue` returns the value for an event.
 * - `maxValue` is used as the end value if a start event remains unmatched.
 *
 * The logic “collapses” consecutive events of the same type and ignores end events
 * that occur before a start event.
 */
export function buildDiscontinuousRange<E, T>(
    events: E[],
    isEnd: (e: E) => boolean,
    getValue: (e: E) => T,
    maxValue: T
): DiscontinuousRange<T> {
    const ranges: ClosedRange<T>[] = [];
    let lastStart: T | null = null;
    let lastEnd: T | null = null;

    for (const event of events) {
        const value = getValue(event);
        if (isEnd(event)) {
            // End event.
            if (lastStart === null) continue; // Ignore end events when no start is active.
            ranges.push({ start: lastStart, endInclusive: value });
            lastStart = null;
            lastEnd = value;
        } else {
            // Start event.
            if (lastStart !== null) continue; // Ignore multiple start events.
            // If an end event occurred immediately before with the same value, “collapse” the events.
            if (lastEnd !== null && lastEnd === value) {
                if (ranges.length > 0) {
                    const lastRange = ranges.pop()!;
                    lastStart = lastRange.start;
                } else {
                    lastStart = value;
                }
            } else {
                lastStart = value;
            }
            lastEnd = null;
        }
    }
    // If a start event remains unmatched, extend its range to maxValue.
    if (lastStart !== null) {
        ranges.push({ start: lastStart, endInclusive: maxValue });
    }
    return new DiscontinuousRange(ranges);
}

/**
 * Given an iterable of DiscontinuousRange<T>, merges them (via union) into one.
 */
export function unionRanges<T>(
    ranges: Iterable<DiscontinuousRange<T>>
): DiscontinuousRange<T> {
    let result: DiscontinuousRange<T> | null = null;
    for (const r of ranges) {
        result = result ? result.union(r) : r;
    }
    return result ?? discRangeOf<T>();
}
