import { Component, computed, Signal, signal } from '@angular/core';
import { SessionService } from '../shared-service/session.service';
import { LoggedInSvgComponent } from '../logged-in-svg/logged-in-svg.component';
import { LoggedOutSvgComponent } from '../logged-out-svg/logged-out-svg.component';

@Component({
  selector: 'app-user-account',
  imports: [LoggedInSvgComponent, LoggedOutSvgComponent],
  templateUrl: './user-account.component.html',
  styleUrl: './user-account.component.scss'
})
export class UserAccountComponent {
  isLoggedIn = computed(() => this.sessionService.isLoggedIn);
  profileMail = computed(() => this.sessionService.email);
  profileName = computed(() => this.sessionService.givenName + " " + this.sessionService.familyName);
  profilePhoto = computed(() => this.sessionService.thumbnailPhoto || "");
  hasProfilePhoto = computed(() => this.sessionService.thumbnailPhoto != null);

  constructor(private sessionService: SessionService) {
    this.sessionService.restoreSessionFromStore().then(() => {
      console.log("User is logged in!");
    }).catch(() => {
      console.log("User is logged out!");
    });
  }

  handleLogoutClick() {
    this.sessionService.unauthorizeSession("You have been logged out");
  }

  handleLoginClick() {
    this.sessionService.authorizeSession();
  }
}
