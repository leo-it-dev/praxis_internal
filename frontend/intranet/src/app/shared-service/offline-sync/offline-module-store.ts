import { computed, signal, Signal, WritableSignal } from "@angular/core";
import { OfflineEntry } from "./offline-entry";

export class OfflineModuleStore {

    private _offlineEntries: WritableSignal<OfflineEntry[]> = signal([]);
    private _name: string;
    private _displayName: string;
    private _path: string;
    private _parentKeyPrefix: string;

    get name() { return this._name };
    get displayName() { return this._displayName };
    get path() { return this._path };

    entryCount = computed(() => this._offlineEntries().length);

    constructor(keyPrefix: string, name: string, displayName: string, path: string) {
        this._parentKeyPrefix = keyPrefix;
        this._name = name;
        this._displayName = displayName;
        this._path = path;
        this.recall();
    }

    appendEntry(offlineEntry: OfflineEntry) {
        this._offlineEntries.update(current => [...current, offlineEntry]);
        this.store();
    }

    removeEntry(offlineEntry: OfflineEntry) {
        this._offlineEntries.update(current => [...current].filter(c => c != offlineEntry));
        this.store();
    }

    private keyPrefix() {
        return this._parentKeyPrefix + this._name;
    }

    store() {
        localStorage.setItem(this.keyPrefix(), JSON.stringify(this._offlineEntries().map(e => e.serialize())));
    }

    recall() {
        let item = localStorage.getItem(this.keyPrefix());
        if (item != null) {
            let entryArray: string[] = JSON.parse(item);
            this._offlineEntries.update(_ => entryArray.map(entry => OfflineEntry.deserialize(entry))); // overwrite array with new items
        }
    }

    getEntry(idx: number): OfflineEntry | undefined {
        return this._offlineEntries().at(idx);
    }
}