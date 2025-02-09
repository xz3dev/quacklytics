import {FileDownload, FileMetadata} from "@/services/file-catalog.ts";
import {create} from "zustand";
import {findMaxDate, findMinDate, updateDate} from "@lib/utils/date-comparison.ts";

interface DateRangeStore {
    minDate: Date | null
    maxDate: Date | null
    updateDateRange: (files: Array<FileDownload>) => void
    isLoaded: (file: FileMetadata) => boolean
}

export const useDataRangeStore = create<DateRangeStore>((set, get,) => ({
    minDate: null,
    maxDate: null,

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

        console.debug(`minDate: ${newMinDate}, maxDate: ${newMaxDate}`)
    },

    isLoaded: (file: FileMetadata) => {
        const {minDate, maxDate} = get()
        const start = new Date(file.start)
        const end = new Date(file.end)
        if (!minDate || !maxDate) return false;

        const isIncluded = (date: Date) => minDate <= date && date <= maxDate;

        return isIncluded(start) && isIncluded(end);
    }
}));

