import { Component, effect, EventEmitter, Input, OnInit, Output, signal, Signal, WritableSignal } from '@angular/core';
import { SessionProviderService, SessionType } from '../shared-service/session/session-provider.service';
import { OfflineModuleStore } from '../shared-service/offline-sync/offline-module-store';
import { OfflineEntry } from '../shared-service/offline-sync/offline-entry';
import { ErrorlistService } from '../errorlist/errorlist.service';

export class CommitSynchronizeEntryEvent {

	private _entry: OfflineEntry;
	synchronizationSuccess: Promise<void>|undefined;

	constructor(entry: OfflineEntry) {
		this._entry = entry;
		this.synchronizationSuccess = undefined;
	}

	get entry() {
		return this._entry;
	}
}

export class ApplyEntryEvent {

	private _entry: OfflineEntry;
	applyFinished: Promise<void>|undefined;

	constructor(entry: OfflineEntry) {
		this._entry = entry;
		this.applyFinished = undefined;
	}

	get entry() {
		return this._entry;
	}
}

@Component({
	selector: 'app-sync-online-controller',
	imports: [],
	templateUrl: './sync-online-controller.component.html',
	styleUrl: './sync-online-controller.component.scss'
})
export class SyncOnlineControllerComponent {

	sessionProvider: SessionProviderService;
	errorlistService: ErrorlistService;

	@Input({required: true})
	offlineStore: OfflineModuleStore|undefined = undefined;

	@Output("applyOfflineEntry")
	applyOfflineEntry: EventEmitter<ApplyEntryEvent> = new EventEmitter<ApplyEntryEvent>(false);
	@Output("commitSynchronizeEntry")
	commitSynchronizeEntry: EventEmitter<CommitSynchronizeEntryEvent> = new EventEmitter<CommitSynchronizeEntryEvent>(false);
	@Output("unloadOfflineEntry")
	unloadOfflineEntry: EventEmitter<void> = new EventEmitter<void>(false);

	selectedItemIdx: WritableSignal<number> = signal(0);

	_syncMode: WritableSignal<boolean> = signal(false);

	constructor(sessionProvider: SessionProviderService,
				errorlistService: ErrorlistService
	) {
		this.sessionProvider = sessionProvider;
		this.errorlistService = errorlistService;
	}

	isOnlineSession(): boolean {
		return this.sessionProvider.getSessionType() == SessionType.ONLINE;
	}

	selectPreviousItem(): Promise<OfflineEntry|undefined> {
		let cur = this.selectedItemIdx();
		this.selectedItemIdx.set(Math.max(0, cur - 1));
		let entry = this.executeLoadItem();
		return entry;
	}

	selectNextItem(): Promise<OfflineEntry|undefined> {
		let cur = this.selectedItemIdx();
		this.selectedItemIdx.set(Math.min(cur + 1, (this.offlineStore?.entryCount() || 1)-1));
		let entry = this.executeLoadItem();
		return entry;
	}

	executeLoadItem(): Promise<OfflineEntry|undefined> {
		return new Promise((res, rej) => {
			let entry = this.offlineStore?.getEntry(this.selectedItemIdx());
			if (entry) {
				
				let applyEvent = new ApplyEntryEvent(entry);
				this.applyOfflineEntry.emit(applyEvent);

				if (applyEvent.applyFinished == undefined) {
					this.errorlistService.showErrorMessage("ApplyEntryEvent fired, but no callback handler registered!");
					rej();
					return;
				}

				applyEvent.applyFinished.then(() => {
					res(entry);
				});
			} else {
				res(undefined);
			}
		});
	}

	clearUI() {
		this.unloadOfflineEntry.emit();
	}

	deleteEntry(entry: OfflineEntry): Promise<OfflineEntry|undefined> {
		this.offlineStore?.removeEntry(entry);
		if (this.offlineStore?.entryCount() == 0) {
			this._syncMode.set(false);
			return Promise.resolve(undefined);
		} else {
			this.selectedItemIdx.set(Math.max(0, this.selectedItemIdx() - 1));
			let nextEntry = this.executeLoadItem();
			return nextEntry;
		}
	}

	enterSynchronizationMode(): Promise<OfflineEntry|undefined> {
		this._syncMode.set(true);
		let currentEntry = this.executeLoadItem();
		return currentEntry;
	}

	exitSynchronizationMode() {
		this._syncMode.set(false);
		this.clearUI();
	}

	isSyncMode() {
		return this._syncMode();
	}

	syncModeCanBeEntered() {
		return (this.offlineStore?.entryCount() || 0) > 0 && this.isOnlineSession();
	}

	async commitAllEntries() {
		if ((this.offlineStore?.entryCount() || 0) > 0 && this.isSyncMode()) {
			let currentEntry = this.offlineStore?.getEntry(this.selectedItemIdx());
			let synchSuccess = true;
			while(currentEntry) {
				let event = new CommitSynchronizeEntryEvent(currentEntry);
				this.commitSynchronizeEntry.emit(event);
				try {
					if (event.synchronizationSuccess == undefined) {
						this.errorlistService.showErrorMessage("CommitSynchronizeEntryEvent fired, but no callback handler registered!");
						return;
					}

					await event.synchronizationSuccess;
					currentEntry = await this.deleteEntry(currentEntry);
				} catch(e) {
					synchSuccess = false;
					break;
				}
			}
			if (synchSuccess) {
				this.exitSynchronizationMode();
			}
		}
	}

	entryCount() {
		return this.offlineStore?.entryCount() || 0;
	}
}
