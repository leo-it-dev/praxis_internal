import { Component, effect, EventEmitter, Input, OnInit, Output, signal, Signal, WritableSignal } from '@angular/core';
import { SessionProviderService, SessionType } from '../shared-service/session/session-provider.service';
import { OfflineModuleStore } from '../shared-service/offline-sync/offline-module-store';
import { OfflineEntry } from '../shared-service/offline-sync/offline-entry';

@Component({
	selector: 'app-sync-online-controller',
	imports: [],
	templateUrl: './sync-online-controller.component.html',
	styleUrl: './sync-online-controller.component.scss'
})
export class SyncOnlineControllerComponent implements OnInit {

	sessionProvider: SessionProviderService;

	@Input({required: true})
	offlineStore: OfflineModuleStore|undefined = undefined;

	@Output("applyOfflineEntry")
	applyOfflineEntry: EventEmitter<OfflineEntry> = new EventEmitter<OfflineEntry>();
	@Output("unloadOfflineEntry")
	unloadOfflineEntry: EventEmitter<void> = new EventEmitter<void>();

	selectedItemIdx: WritableSignal<number> = signal(0);

	_syncMode: WritableSignal<boolean> = signal(false);

	constructor(sessionProvider: SessionProviderService) {
		this.sessionProvider = sessionProvider;
	}

	ngOnInit(): void {
		// this.executeLoadItem();
	}

	isOnlineSession(): boolean {
		return this.sessionProvider.getSessionType() == SessionType.ONLINE;
	}

	selectPreviousItem() {
		let cur = this.selectedItemIdx();
		this.selectedItemIdx.set(Math.max(0, cur - 1));
		this.executeLoadItem();
	}

	selectNextItem() {
		let cur = this.selectedItemIdx();
		this.selectedItemIdx.set(Math.min(cur + 1, (this.offlineStore?.entryCount() || 1)-1));
		this.executeLoadItem();
	}

	executeLoadItem() {
		this.applyOfflineEntry.emit(this.offlineStore?.getEntry(this.selectedItemIdx()));
	}

	clearUI() {
		this.unloadOfflineEntry.emit();
	}

	deleteEntry(entry: OfflineEntry) {
		this.offlineStore?.removeEntry(entry);
		if (this.offlineStore?.entryCount() == 0) {
			this._syncMode.set(false);
		} else {
			this.selectedItemIdx.set(Math.max(0, this.selectedItemIdx() - 1));
			this.executeLoadItem();
		}
	}

	enterSynchronizationMode() {
		this._syncMode.set(true);
		this.executeLoadItem();
	}

	exisSynchronizationMode() {
		this._syncMode.set(false);
		this.clearUI();
	}

	isSyncMode() {
		return this._syncMode();
	}

	syncModeCanBeEntered() {
		return (this.offlineStore?.entryCount() || 0) > 0;
	}
}
