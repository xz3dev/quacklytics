
export class IndexedDBManager {
  constructor(
    private dbName: string,
    private storeName: string,
  ) {
    void this.initDB();
  }

  private async initDB(): Promise<void> {
    return new Promise((resolve, reject) => {
      const request = indexedDB.open(this.dbName, 1);
      request.onerror = () => reject('Error opening database');
      request.onsuccess = () => resolve();
      request.onupgradeneeded = (event) => {
        const db = (event.target as IDBOpenDBRequest).result;
        db.createObjectStore(this.storeName, { keyPath: 'filename' });
      };
    });
  }

  private async openDB(): Promise<IDBDatabase> {
    return new Promise((resolve, reject) => {
      const request = indexedDB.open(this.dbName);
      request.onerror = () => reject('Error opening database');
      request.onsuccess = (event) => resolve((event.target as IDBOpenDBRequest).result);
    });
  }

  async saveFile(filename: string, blob: Blob): Promise<void> {
    const db = await this.openDB();
    const transaction = db.transaction([this.storeName], 'readwrite');
    const store = transaction.objectStore(this.storeName);
    await this.wrapIDBRequest(store.put({ filename, blob }));
  }

  async getFile(filename: string): Promise<Blob | null> {
    const db = await this.openDB();
    const transaction = db.transaction([this.storeName], 'readonly');
    const store = transaction.objectStore(this.storeName);
    const result = await this.wrapIDBRequest(store.get(filename));
    return result ? result.blob : null;
  }

  async getAllFiles(): Promise<Array<{ filename: string; blob: Blob }>> {
    const db = await this.openDB();
    const transaction = db.transaction([this.storeName], 'readonly');
    const store = transaction.objectStore(this.storeName);
    return (await this.wrapIDBRequest(store.getAll())) ?? [];
  }

  private async wrapIDBRequest<T>(request: IDBRequest<T>): Promise<T | null> {
    return new Promise((resolve, reject) => {
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });
  }
}
