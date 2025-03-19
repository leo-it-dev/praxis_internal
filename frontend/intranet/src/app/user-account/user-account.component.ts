import { Component, computed } from '@angular/core';
import { LoggedInSvgComponent } from '../logged-in-svg/logged-in-svg.component';
import { LoggedOutSvgComponent } from '../logged-out-svg/logged-out-svg.component';
import { SessionProviderService } from '../shared-service/session/session-provider.service';

@Component({
	selector: 'app-user-account',
	imports: [LoggedInSvgComponent, LoggedOutSvgComponent],
	templateUrl: './user-account.component.html',
	styleUrl: './user-account.component.scss'
})
export class UserAccountComponent {
	isLoggedIn = computed(() => this.sessionService.store.isLoggedIn);
	profileMail = computed(() => this.sessionService.store.email);
	profileName = computed(() => this.sessionService.store.givenName + " " + this.sessionService.store.familyName);
	profilePhoto = computed(() => this.sessionService.store.thumbnailPhoto || "");
	hasProfilePhoto = computed(() => this.sessionService.store.thumbnailPhoto !== null && this.sessionService.store.thumbnailPhoto !== "");

	constructor(private sessionService: SessionProviderService) { }

	handleLogoutClick() {
		this.sessionService.unauthorizeSession("You have been logged out");
	}

	handleLoginClick() {
		this.sessionService.selectOnlineSessionProvider();
		this.sessionService.authorizeSession();
	}

	handleLoginOfflineClick() {
		this.sessionService.selectOfflineSessionProvider();
		this.sessionService.authorizeSession();
	}
}
