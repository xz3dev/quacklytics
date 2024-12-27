import {ParquetDownloader} from "@lib/parquet-downloader.ts";
import {calculateChecksum} from "@lib/checksums.ts";
import {IndexedDBManager} from "@lib/index-db-manager.ts";

export class ParquetManager {
    private dbManager: IndexedDBManager;
    private downloader: ParquetDownloader;

    constructor() {
        this.dbManager = new IndexedDBManager('ParquetStorage', 'parquetFiles');
        this.downloader = new ParquetDownloader();
    }

    async downloadLast12Weeks(eventType?: string): Promise<{ filename: string; blob: Blob }[]> {
        console.log(`Downloading last 12 weeks...`);
        const serverChecksums = await this.downloader.getServerChecksums();
        const localFiles = await this.dbManager.getAllFiles();
        const localChecksums = await this.getLocalChecksums(localFiles);

        const promises: Promise<any>[] = [];
        for (const [filename, serverChecksum] of Object.entries(serverChecksums)) {
            const localChecksum = localChecksums[filename];

            if (serverChecksum !== localChecksum) {
                const [, kw, year] = filename.match(/events_kw(\d+)_(\d+)\.parquet/) || [];
                if (kw && year) {
                    promises.push(
                        new Promise(async (resolve) => {
                            await this.downloadAndSaveParquetFile(parseInt(kw), parseInt(year), eventType);
                            resolve(null);
                        }),
                    );
                }
            }
        }
        await Promise.all(promises);
        const localFilesAfterUpdate = await this.dbManager.getAllFiles();
        // await dbManager.importParquetFiles(localFilesAfterUpdate);
        return localFilesAfterUpdate
    }

    private async downloadAndSaveParquetFile(
        kw: number,
        year: number,
        eventType?: string,
    ): Promise<void> {
        try {
            const blob = await this.downloader.downloadParquetFile(kw, year, eventType);
            const filename = `events_kw${kw}_${year}.parquet`;
            await this.dbManager.saveFile(filename, blob);
            console.log(`Saved ${filename} to IndexedDB`);
        } catch (error) {
            console.error(`Failed to download or save file for week ${kw}, year ${year}: ${error}`);
        }
    }

    private async getLocalChecksums(
        files: Array<{ filename: string; blob: Blob }>,
    ): Promise<Record<string, string>> {
        const checksums: Record<string, string> = {};
        for (const file of files) {
            checksums[file.filename] = await calculateChecksum(file.blob);
        }
        return checksums;
    }

    async getParquetFile(filename: string): Promise<Blob | null> {
        return this.dbManager.getFile(filename);
    }
}
