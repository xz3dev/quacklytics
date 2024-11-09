// ParquetDownloader.ts
import { http } from '$lib/client/fetch';
import { baseUrl } from '$lib/client/client';

export class ParquetDownloader {
  constructor() {}

  async downloadParquetFile(kw: number, year: number, eventType?: string): Promise<Blob> {
    const url =
      `${baseUrl}/events/parquet/kw?kw=${kw}&year=${year}` +
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
    } = await http.get('events/parquet/checksums');
    return response.checksums;
  }
}
