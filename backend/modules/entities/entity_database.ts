import { Chunk } from "../../../api_common/generic_types/chunk";

export abstract class ReadOnlyEntityDatabase<CTX extends string, T extends Chunk> {

    abstract readonly context: CTX;
    abstract readonly databaseName: string;

    private lastAcquisitionResult: T[] = [];
    private mutableAcquisitionResult: T[] = [];

    protected abstract readAll(): Promise<T[]>;
    public async acquire() {
        return new Promise<void>((res, rej) => {
            this.readAll().then(chunks => {
                this.lastAcquisitionResult = chunks;
                res();
            }).catch(err => {
                rej(err);
            })
        });
    }

    public getLastAcquisitionResult() {
        return this.lastAcquisitionResult;
    }

    public copyAcquisitionResultToMutableBuffer() {
        this.mutableAcquisitionResult = [...this.lastAcquisitionResult]
    }

    public findAndPopChunk(commonId: string): T | undefined {
        let idx = this.mutableAcquisitionResult.findIndex(chunk => chunk.commonId == commonId);
        if (idx != -1) {
            let chunk = this.mutableAcquisitionResult.splice(idx, 1)[0];
            return chunk;
        }
        return undefined;
    }

    public getRemainingMutableChunks(): T[] {
        return this.mutableAcquisitionResult;
    }
}

export abstract class WritableHydrationDatabase<CTX extends string, T extends Chunk> extends ReadOnlyEntityDatabase<CTX, T> {
    abstract constructDefaultChunk(commonId: string): T;
    abstract addOrModify(chunk: T): Promise<number>;
    abstract deleteChunk(chunk: T): Promise<void>;
}
