import { Component, OnInit } from '@angular/core';
import { Router } from '@angular/router';
import { SessionProviderService } from '../shared-service/session/session-provider.service';
import { UserAccountComponent } from '../user-account/user-account.component';
import { ModuleService } from '../module/module.service';
import { ErrorlistService } from '../timed-popups/popuplist/errorlist.service';

@Component({
	selector: 'app-login',
	imports: [UserAccountComponent],
	templateUrl: './login.component.html',
	styleUrl: './login.component.scss'
})
export class LoginComponent implements OnInit {
	constructor(private sessionService: SessionProviderService,
		private errorlistService: ErrorlistService,
		private router: Router,
		private moduleService: ModuleService) {
	}

	ngOnInit(): void {
		if (window.location.search.includes("?code")) {
			const callbackParams = document.location.search.split("&");
			const code = callbackParams[0].split("code=")[1];
			const state = callbackParams[1].split("state=")[1];

			this.sessionService.selectOnlineSessionProvider();
			this.sessionService.exchangeCodeForToken(code, state).then(() => {
				this.router.navigateByUrl("/login").then(() => {
					this.moduleService.updateBackendCaches();
				});
			});
		}
	}
}
