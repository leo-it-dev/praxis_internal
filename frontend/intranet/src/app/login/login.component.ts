import { Component } from '@angular/core';
import { UserAccountComponent } from '../user-account/user-account.component';
import { ActionbarComponent } from '../actionbar/actionbar.component';
import { SessionService } from '../shared-service/session.service';
import { ErrorlistService } from '../errorlist/errorlist.service';
import { Router } from '@angular/router';

@Component({
	selector: 'app-login',
	imports: [UserAccountComponent],
	templateUrl: './login.component.html',
	styleUrl: './login.component.scss'
})
export class LoginComponent {
	constructor(private sessionService: SessionService,
		private errorlistService: ErrorlistService,
		private router: Router) {

		if (window.location.search.includes("?code")) {
			const callbackParams = document.location.search.split("&");
			const code = callbackParams[0].split("code=")[1];
			const state = callbackParams[1].split("state=")[1];
			console.log("Code: ", code);
			console.log("State: ", state);
			this.sessionService.exchangeCodeForToken(code, state).then(() => {
				this.router.navigateByUrl("/login");
			});
		}
	}
}
