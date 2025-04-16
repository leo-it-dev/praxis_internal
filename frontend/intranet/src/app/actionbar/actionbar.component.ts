import { Component, computed } from '@angular/core';
import { RouterLink } from '@angular/router';
import { LoggedInSvgComponent } from '../logged-in-svg/logged-in-svg.component';
import { LoggedOutSvgComponent } from '../logged-out-svg/logged-out-svg.component';
import { SessionProviderService } from '../shared-service/session/session-provider.service';
import { UserAccountPopupComponent } from '../user-account-popup/user-account-popup.component';
import { SyncPopupComponent } from "../sync-popup/sync-popup.component";
import { OfflineStoreService } from '../shared-service/offline-sync/offline-store.service';

@Component({
	selector: 'app-actionbar',
	imports: [LoggedInSvgComponent, LoggedOutSvgComponent, UserAccountPopupComponent, RouterLink, SyncPopupComponent],
	templateUrl: './actionbar.component.html',
	styleUrl: './actionbar.component.scss'
})
export class ActionbarComponent {
	isLoggedIn = computed(() => this.sessionService.store.isLoggedIn);
	profilePhoto = computed(() => this.sessionService.store.thumbnailPhoto ?? "");
	hasProfilePhoto = computed(() => this.sessionService.store.thumbnailPhoto !== null && this.sessionService.store.thumbnailPhoto !== "");

	totalUnsyncCount = computed(() => this.offlineStoreService.totalEntryCount());

	activePopup: string | undefined = undefined;
	updatePopup(name: string) {
		if (this.activePopup != name) {
			this.activePopup = name;
		} else {
			this.activePopup = undefined;
		}
	}

	constructor(private sessionService: SessionProviderService,
				private offlineStoreService: OfflineStoreService
	) { }
}
