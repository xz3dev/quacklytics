import {FileDownload, FileMetadata} from "@/services/file-catalog.ts";
import {create} from "zustand";
import {findMaxDate, findMinDate, updateDate} from "@lib/utils/date-comparison.ts";

interface DateRangeStore {
    minDate: Date | null
    maxDate: Date | null
    effectiveMinDate: Date | null
    effectiveMaxDate: Date | null
    updateDateRange: (files: Array<FileDownload>) => void
    updateEffectiveDateRange: (min: Date, max: Date) => void
    updateMaxDate: (date: Date) => void
    isLoaded: (file: FileMetadata) => boolean
}

export const useDataRangeStore = () => create<DateRangeStore>((set, get,) => ({
    minDate: null,
    maxDate: null,

    effectiveMinDate: null,
    effectiveMaxDate: null,

    /**
     * Updates the date range for the provided files by calculating the earliest
     * start date and the latest end date among the files. If the provided files
     * array is empty, no updates are made.
     *
     * @param {Array<FileDownload>} files - An array of file metadata objects,
     * each containing a start and end date field.
     */
    updateDateRange: (files: Array<FileDownload>) => {
        if (files.length === 0) return;

        const startDates = files.map(file => new Date(file.start));
        const endDates = files.map(file => new Date(file.end));

        const newMinDate = findMinDate(startDates);
        const newMaxDate = findMaxDate(endDates);

        set(state => ({
            minDate: updateDate(state.minDate, newMinDate, (a, b) => a < b),
            maxDate: updateDate(state.maxDate, newMaxDate, (a, b) => a > b),
        }));
    },


    /**
     * Updates the maximum date with the provided date if the new date is later
     * than the current maximum date.
     *
     * @param {Date} date - The new date to compare and potentially set as the max date.
     */
    updateMaxDate: (date: Date) => {
        set(state => ({
            maxDate: updateDate(state.maxDate, date, (a, b) => a > b),
        }));
    },


    updateEffectiveDateRange: (min: Date, max: Date) => {
        set(state => ({
            effectiveMinDate: updateDate(state.effectiveMinDate, min, (a, b) => a < b),
            effectiveMaxDate: updateDate(state.effectiveMaxDate, max, (a, b) => a > b),
        }));
    },


    /**
     * Determines if the given file's start and end dates fall within
     * the configured minimum and maximum date range.
     *
     * @param {FileMetadata} file - The metadata of the file including start and end dates.
     * @returns {boolean} - True if the file's start and end dates are within the date range, otherwise false.
     */
    isLoaded: (file: FileMetadata): boolean => {
        const {minDate, maxDate} = get()
        const start = new Date(file.start)
        if (!minDate || !maxDate) return false;

        const isIncluded = (date: Date) => {
            return minDate.getTime() <= date.getTime() && date.getTime() <= maxDate.getTime();
        };

        return isIncluded(start)
    }
}));

