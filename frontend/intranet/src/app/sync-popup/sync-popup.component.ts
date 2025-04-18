import { Component } from '@angular/core';
import { OfflineStoreService } from '../shared-service/offline-sync/offline-store.service';
import { NgFor } from '@angular/common';
import { OfflineModuleStore } from '../shared-service/offline-sync/offline-module-store';
import { Router } from '@angular/router';
import { SessionProviderService } from '../shared-service/session/session-provider.service';

@Component({
	selector: 'app-sync-popup',
	imports: [NgFor],
	templateUrl: './sync-popup.component.html',
	styleUrl: './sync-popup.component.scss'
})
export class SyncPopupComponent {

	_syncController: OfflineStoreService;
	_sessionService: SessionProviderService

	constructor( private syncController: OfflineStoreService, 
				private router: Router,
				private sessionService: SessionProviderService) {
		this._syncController = syncController;
		this._sessionService = sessionService;
	}

	trackByFn(index: number, item: OfflineModuleStore) {
		return item.entryCount();
	}

	openModuleByPath(path: string) {
		this.router.navigateByUrl(path);
	}
}
