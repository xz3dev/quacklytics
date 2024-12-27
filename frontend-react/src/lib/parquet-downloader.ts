import {baseUrlWithProject} from "@app/conf.ts";
import {http} from "@lib/fetch.ts";

export class ParquetDownloader {
    constructor() {
    }

    async downloadParquetFile(kw: number, year: number, eventType?: string): Promise<Blob> {
        const url =
            `${baseUrlWithProject}/events/parquet/kw?kw=${kw}&year=${year}` +
            (eventType ? `&type=${eventType}` : '');
        const response = await fetch(url, {
            method: 'GET',
            credentials: 'include',
        });
        if (!response.ok) throw new Error(`HTTP error! status: ${response.status}`);
        return response.blob();
    }

    async getServerChecksums(): Promise<Record<string, string>> {
        const response: {
            checksums: Record<string, string>;
        } | undefined = await http.get('/test/events/parquet/checksums');
        return response?.checksums ?? {};
    }
}
