import { Component, computed, HostListener } from '@angular/core';
import { SessionService } from '../shared-service/session.service';
import { LoggedInSvgComponent } from '../logged-in-svg/logged-in-svg.component';
import { LoggedOutSvgComponent } from '../logged-out-svg/logged-out-svg.component';
import { Router } from '@angular/router';

@Component({
  selector: 'app-user-account-popup',
  imports: [LoggedInSvgComponent, LoggedOutSvgComponent],
  templateUrl: './user-account-popup.component.html',
  styleUrl: './user-account-popup.component.scss'
})
export class UserAccountPopupComponent {
  isLoggedIn = computed(() => this.sessionService.isLoggedIn);
  profileMail = computed(() => this.sessionService.email);
  profileName = computed(() => this.sessionService.givenName + " " + this.sessionService.familyName);
  profilePhoto = computed(() => this.sessionService.thumbnailPhoto || "");
  hasProfilePhoto = computed(() => this.sessionService.thumbnailPhoto != null);

  constructor(private sessionService: SessionService,
              private router: Router) {
    this.sessionService.restoreSessionFromStore().then(() => {
      console.log("User is logged in!");
    }).catch(() => {
      console.log("User is logged out!");
    });
  }

  @HostListener('click', ['$event'])
  openProfilePage() {
    this.router.navigateByUrl("/login");
  }
}
