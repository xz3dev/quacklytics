import {FileDownload} from "@/services/file-catalog.ts";
import {create} from "zustand";
import {findMaxDate, findMinDate, updateDate} from "@lib/utils/date-comparison.ts";

interface DateRangeStore {
    minDate: Date | null;
    maxDate: Date | null;
    updateDateRange: (files: Array<FileDownload>) => void;
}

export const useDataRangeStore = create<DateRangeStore>((set, ) => ({
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

        console.log(`minDate: ${newMinDate}, maxDate: ${newMaxDate}`)
    },
}));
