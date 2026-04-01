const DB_NAME = "pmtiles-db";
const STORE_NAME = "files";

export async function openDB(): Promise<IDBDatabase> {
	return new Promise((resolve, reject) => {
		const req = indexedDB.open(DB_NAME, 1);

		req.onupgradeneeded = () => {
			req.result.createObjectStore(STORE_NAME);
		};

		req.onsuccess = () => resolve(req.result);
		req.onerror = () => reject(req.error);
	});
}

export async function saveFile(key: string, buffer: ArrayBuffer) {
	const db = await openDB();

	return new Promise<void>((resolve, reject) => {
		const tx = db.transaction(STORE_NAME, "readwrite");
		tx.objectStore(STORE_NAME).put(buffer, key);

		tx.oncomplete = () => resolve();
		tx.onerror = () => reject(tx.error);
	});
}

export async function getFile(key: string): Promise<ArrayBuffer | null> {
	const db = await openDB();

	return new Promise((resolve, reject) => {
		const tx = db.transaction(STORE_NAME, "readonly");
		const req = tx.objectStore(STORE_NAME).get(key);

		req.onsuccess = () => resolve(req.result ?? null);
		req.onerror = () => reject(req.error);
	});
}
