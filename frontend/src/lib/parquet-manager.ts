export class ParquetManager {
    private dbName = 'ParquetStorage'
    private storeName = 'parquetFiles'
    private baseUrl = 'http://localhost:3000/events/parquet/kw'

    constructor() {
        this.initDB()
    }

    private async initDB(): Promise<void> {
        return new Promise((resolve, reject) => {
            const request = indexedDB.open(this.dbName, 1)

            request.onerror = () => reject('Error opening database')
            request.onsuccess = () => resolve()

            request.onupgradeneeded = (event) => {
                const db = (event.target as IDBOpenDBRequest).result
                db.createObjectStore(this.storeName, { keyPath: 'filename' })
            }
        })
    }

    async downloadAndSaveParquetFile(kw: number, year: number, eventType?: string): Promise<void> {
        const url = `${this.baseUrl}?kw=${kw}&year=${year}` + (eventType ? `&type=${eventType}` : '')

        try {
            const response = await fetch(url)
            if (!response.ok) throw new Error(`HTTP error! status: ${response.status}`)

            const blob = await response.blob()
            const filename = `events_kw${kw}_${year}.parquet`

            await this.saveToIndexedDB(filename, blob)
            console.log(`Saved ${filename} to IndexedDB`)
        } catch (error) {
            console.error(`Failed to download or save file for week ${kw}, year ${year}: ${error}`)
        }
    }

    private async saveToIndexedDB(filename: string, blob: Blob): Promise<void> {
        return new Promise((resolve, reject) => {
            const request = indexedDB.open(this.dbName)

            request.onerror = () => reject('Error opening database')

            request.onsuccess = (event) => {
                const db = (event.target as IDBOpenDBRequest).result
                const transaction = db.transaction([this.storeName], 'readwrite')
                const store = transaction.objectStore(this.storeName)

                const saveRequest = store.put({ filename, blob })

                saveRequest.onerror = () => reject('Error saving to database')
                saveRequest.onsuccess = () => resolve()
            }
        })
    }

    async getParquetFile(filename: string): Promise<Blob | null> {
        return new Promise((resolve, reject) => {
            const request = indexedDB.open(this.dbName)

            request.onerror = () => reject('Error opening database')

            request.onsuccess = (event) => {
                const db = (event.target as IDBOpenDBRequest).result
                const transaction = db.transaction([this.storeName], 'readonly')
                const store = transaction.objectStore(this.storeName)

                const getRequest = store.get(filename)

                getRequest.onerror = () => reject('Error retrieving from database')
                getRequest.onsuccess = () => {
                    const result = getRequest.result
                    resolve(result ? result.blob : null)
                }
            }
        })
    }

    async downloadLast12Weeks(eventType?: string): Promise<void> {
        const currentDate = new Date()
        const currentYear = currentDate.getFullYear()
        const currentWeek = this.getWeekNumber(currentDate)

        for (let i = 0; i < 12; i++) {
            let week = currentWeek - i
            let year = currentYear

            if (week <= 0) {
                week += 52
                year -= 1
            }

            const filename = `events_kw${week}_${year}.parquet`;
            const fileExists = await this.checkFileExists(filename);

            if (i === 0 || !fileExists) {
                console.log(`Downloading ${filename}...`);
                await this.downloadAndSaveParquetFile(week, year, eventType);
            } else {
                console.log(`Skipping download for ${filename} as it already exists.`);
            }
        }
    }

    private getWeekNumber(date: Date): number {
        const d = new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()))
        const dayNum = d.getUTCDay() || 7
        d.setUTCDate(d.getUTCDate() + 4 - dayNum)
        const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1))
        return Math.ceil((((d.getTime() - yearStart.getTime()) / 86400000) + 1) / 7)
    }

    private async checkFileExists(filename: string): Promise<boolean> {
        return new Promise((resolve, reject) => {
            const request = indexedDB.open(this.dbName)

            request.onerror = () => reject('Error opening database')

            request.onsuccess = (event) => {
                const db = (event.target as IDBOpenDBRequest).result
                const transaction = db.transaction([this.storeName], 'readonly')
                const store = transaction.objectStore(this.storeName)

                const getRequest = store.get(filename)

                getRequest.onerror = () => reject('Error checking file existence')
                getRequest.onsuccess = () => {
                    resolve(!!getRequest.result)
                }
            }
        })
    }
}
