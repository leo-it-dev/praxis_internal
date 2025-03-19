import { Component, computed, HostListener, OnInit } from '@angular/core';
import { Router } from '@angular/router';
import { LoggedInSvgComponent } from '../logged-in-svg/logged-in-svg.component';
import { LoggedOutSvgComponent } from '../logged-out-svg/logged-out-svg.component';
import { SessionProviderService } from '../shared-service/session/session-provider.service';

@Component({
	selector: 'app-user-account-popup',
	imports: [LoggedInSvgComponent, LoggedOutSvgComponent],
	templateUrl: './user-account-popup.component.html',
	styleUrl: './user-account-popup.component.scss'
})
export class UserAccountPopupComponent {
	isLoggedIn = computed(() => this.sessionService.store.isLoggedIn);
	profileMail = computed(() => this.sessionService.store.email);
	profileName = computed(() => this.sessionService.store.givenName + " " + this.sessionService.store.familyName);
	profilePhoto = computed(() => this.sessionService.store.thumbnailPhoto || "");
	hasProfilePhoto = computed(() => this.sessionService.store.thumbnailPhoto !== null && this.sessionService.store.thumbnailPhoto !== "");

	constructor(private sessionService: SessionProviderService,
		private router: Router) {
	}

	@HostListener('click', ['$event'])
	openProfilePage() {
		this.router.navigateByUrl("/login");
	}
}
