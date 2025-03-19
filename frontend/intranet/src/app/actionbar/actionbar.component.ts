import { Component, computed } from '@angular/core';
import { RouterLink } from '@angular/router';
import { LoggedInSvgComponent } from '../logged-in-svg/logged-in-svg.component';
import { LoggedOutSvgComponent } from '../logged-out-svg/logged-out-svg.component';
import { SessionProviderService } from '../shared-service/session/session-provider.service';
import { UserAccountPopupComponent } from '../user-account-popup/user-account-popup.component';

@Component({
	selector: 'app-actionbar',
	imports: [LoggedInSvgComponent, LoggedOutSvgComponent, UserAccountPopupComponent, RouterLink],
	templateUrl: './actionbar.component.html',
	styleUrl: './actionbar.component.scss'
})
export class ActionbarComponent {
	isLoggedIn = computed(() => this.sessionService.store.isLoggedIn);
	profilePhoto = computed(() => this.sessionService.store.thumbnailPhoto ?? "");
	hasProfilePhoto = computed(() => this.sessionService.store.thumbnailPhoto !== null && this.sessionService.store.thumbnailPhoto !== "");
	showAccountPopup = false;

	constructor(private sessionService: SessionProviderService) { }
}
