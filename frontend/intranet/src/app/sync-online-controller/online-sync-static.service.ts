import { EventEmitter, Injectable } from '@angular/core';

@Injectable({
	providedIn: 'root'
})
export class OnlineSyncStaticService {

	public synchModeChangeRequest: EventEmitter<boolean> = new EventEmitter<boolean>();
	public currentSyncModeRequest = false;

	constructor() {}

	requestSwitchToSyncMode() {
		this.synchModeChangeRequest.emit(this.currentSyncModeRequest = true);
	}

	requestExitSynchMode() {
		this.synchModeChangeRequest.emit(this.currentSyncModeRequest = false);
	}
}
