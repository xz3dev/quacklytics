
// ParquetDownloader.ts
export class ParquetDownloader {
    constructor(private baseUrl: string) {}

    async downloadParquetFile(kw: number, year: number, eventType?: string): Promise<Blob> {
        const url = `${this.baseUrl}?kw=${kw}&year=${year}` + (eventType ? `&type=${eventType}` : '');
        const response = await fetch(url);
        if (!response.ok) throw new Error(`HTTP error! status: ${response.status}`);
        return response.blob();
    }

    async getServerChecksums(checksumUrl: string): Promise<Record<string, string>> {
        const response = await fetch(checksumUrl);
        if (!response.ok) throw new Error(`HTTP error! status: ${response.status}`);
        const data = await response.json();
        return data.checksums;
    }
}
