import { Source } from "pmtiles";
import { getFile, saveFile } from "../utilities/indexeddb-helper";

export class IndexedDBMapSource implements Source {
    buffer: ArrayBuffer;
    key: string;

    constructor(buffer: ArrayBuffer, key: string) {
        this.buffer = buffer;
        this.key = key;
    }

    getKey() {
        return this.key;
    }

    async getBytes(offset: number, length: number) {
        const slice = this.buffer.slice(offset, offset + length);

        return {
            data: slice,
            cacheControl: "",
            expires: undefined
        };
    }
}

async function downloadPMTiles(url: string) {
    const res = await fetch(url);
    const buffer = await res.arrayBuffer();
    await saveFile(url, buffer);
    return buffer;
}

export async function loadPMTiles(url: string) {
    let data = await getFile(url);
    if (!data) {
        data = await downloadPMTiles(url);
    }
    return data;
}
