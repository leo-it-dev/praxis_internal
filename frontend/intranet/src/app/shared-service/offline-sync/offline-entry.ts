export class OfflineEntry {

    private _item: any;
    constructor(item: any) {
        this._item = item;
    }

    serialize(): string {
        return JSON.stringify(this._item);
    }

    static deserialize(input: string): OfflineEntry {
        return new OfflineEntry(JSON.parse(input));
    }

    get item() {
        return this._item;
    }
}