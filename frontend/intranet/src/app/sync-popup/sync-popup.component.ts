import { Component } from '@angular/core';
import { OfflineStoreService } from '../shared-service/offline-sync/offline-store.service';
import { NgFor } from '@angular/common';
import { OfflineModuleStore } from '../shared-service/offline-sync/offline-module-store';
import { Router } from '@angular/router';
import { SessionProviderService } from '../shared-service/session/session-provider.service';
import { OnlineSyncStaticService } from '../sync-online-controller/online-sync-static.service';

@Component({
	selector: 'app-sync-popup',
	imports: [NgFor],
	templateUrl: './sync-popup.component.html',
	styleUrl: './sync-popup.component.scss'
})
export class SyncPopupComponent {

	constructor( public _syncController: OfflineStoreService, 
				private router: Router,
				public _sessionService: SessionProviderService,
			public _syncStatic: OnlineSyncStaticService) {
	}

	trackByFn(index: number, item: OfflineModuleStore) {
		return item.entryCount();
	}

	openModuleByPath(path: string) {
		if (this.router.url == path) {
			this._syncStatic.requestSwitchToSyncMode();
		} else {
			this.router.navigateByUrl(path).then(() => {
				this._syncStatic.requestSwitchToSyncMode();
			});
		}
	}
}
