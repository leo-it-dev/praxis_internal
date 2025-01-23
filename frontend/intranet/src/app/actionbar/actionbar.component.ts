import { Component, computed } from '@angular/core';
import { SessionService } from '../shared-service/session.service';
import { LoggedInSvgComponent } from '../logged-in-svg/logged-in-svg.component';
import { LoggedOutSvgComponent } from '../logged-out-svg/logged-out-svg.component';
import { UserAccountPopupComponent } from '../user-account-popup/user-account-popup.component';
import { RouterLink } from '@angular/router';

@Component({
  selector: 'app-actionbar',
  imports: [LoggedInSvgComponent, LoggedOutSvgComponent, UserAccountPopupComponent, RouterLink],
  templateUrl: './actionbar.component.html',
  styleUrl: './actionbar.component.scss'
})
export class ActionbarComponent {
  isLoggedIn = computed(() => this.sessionService.isLoggedIn);
  profilePhoto = computed(() => this.sessionService.thumbnailPhoto || "");
  hasProfilePhoto = computed(() => this.sessionService.thumbnailPhoto != null);
  showAccountPopup = false;

  constructor(private sessionService: SessionService) {
    this.sessionService.restoreSessionFromStore().then(() => {
      console.log("User is logged in!");
    }).catch(() => {
      console.log("User is logged out!");
    });
  }
}
