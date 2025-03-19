import { Injectable } from '@angular/core';
import { Router } from '@angular/router';
import { ErrorlistService } from '../../errorlist/errorlist.service';
import { JwtHelperService } from '../jwt-helper.service';
import { SessionOfflineService } from './session-offline.service';
import { SessionOnlineService } from './session-online.service';
import { SessionProviderPlugin } from './session-provider-plugin';
import { SessionStore } from './session-store';

export enum SessionType {
	ONLINE = "Online",
	OFFLINE = "Offline"
}

type IdTokenClaims = {
    given_name: string,
    family_name: string,
    email: string,
    sid: string
};
function assertIDTokenClaims(object: any): asserts object is IdTokenClaims {
    if (typeof object !== "object" || object === null) {
        throw new Error("Input is not a valid object.");
    }
    if (!('given_name' in object) || typeof object['given_name'] != 'string') {
        throw new Error("given_name is invalid: " + (object['given_name'] ?? "<undefined>"));
    }
    if (!('family_name' in object) || typeof object['family_name'] != 'string') {
        throw new Error("family_name is invalid: " + (object['family_name'] ?? "<undefined>"));
    }
    if (!('email' in object) || typeof object['email'] != 'string') {
        throw new Error("email is invalid: " + (object['email'] ?? "<undefined>"));
    }
    if (!('sid' in object) || typeof object['sid'] != 'string') {
        throw new Error("sid is invalid: " + (object['sid'] ?? "<undefined>"));
    }
}

@Injectable({
	providedIn: 'root'
})
export class SessionProviderService {

	static instance: SessionProviderService;

	constructor(
		private sessionOnlineService: SessionOnlineService,
		private sessionOfflineService: SessionOfflineService,
		private errorService: ErrorlistService,
		private jwtHelperService: JwtHelperService,
		private router: Router
	) {
		SessionProviderService.instance = this;

		let storedSessionType = this.detectStoredSessionType();
		if (storedSessionType == SessionType.ONLINE) {
			console.log("Restoring online session");
			this.selectOnlineSessionProvider();
			this.restoreSessionFromStore();
		} else if (storedSessionType == SessionType.OFFLINE) {
			console.log("Restoring offline session");
			this.selectOfflineSessionProvider();
			this.restoreSessionFromStore();
		} else {
			console.log("No session stored to restore.");
		}
	}

	store: SessionStore = new SessionStore(this);
	session?: SessionProviderPlugin = undefined;

	private detectStoredSessionType(): SessionType | null {
		let sessionType = sessionStorage.getItem("sessionType");
		if (sessionType !== null) {
			switch(sessionType) {
				case SessionType.ONLINE:
					return SessionType.ONLINE;
				case SessionType.OFFLINE:
					return SessionType.OFFLINE;
			}
		}
		return null;
	}

	getSessionType(): SessionType|undefined {
		if (this.session == this.sessionOnlineService) {
			return SessionType.ONLINE;
		}
		else if (this.session == this.sessionOfflineService) {
			return SessionType.OFFLINE;
		}
		return undefined;
	}

	selectOnlineSessionProvider() {
		this.session = this.sessionOnlineService;
	}
	selectOfflineSessionProvider() {
		this.session = this.sessionOfflineService;
	}

	removeUserInformation() {
		this.store.isLoggedIn = false;
		this.store.idToken = undefined;
		this.store.accessToken = undefined;
		this.store.refreshToken = undefined;
		this.store.lazyloadUserInfo = undefined;
	}

    authorizeSession(): void {
		if (!this.session) {
			this.errorService.showErrorMessage("Internal error: missing session provider (1)!");
			return;
		}
		this.session.authorizeSession();
	}
    exchangeCodeForToken(code: string, state: string): Promise<void> {
		if (!this.session) {
			this.errorService.showErrorMessage("Internal error: missing session provider (3)!");
			return Promise.reject();
		}
		return this.session.exchangeCodeForToken(code, state);
	}
    unauthorizeSession(reason: string): Promise<void> {
		if (!this.session) {
			this.redirectClientToLoginPage(reason);
			return Promise.resolve();
		}
		return this.session.unauthorizeSession(reason);
	}

	storeSessionInStore(sessionType: SessionType) {
        if (this.store.idToken && this.store._rawAccessToken() && this.store.refreshToken && this.store.lazyloadUserInfo) {
			sessionStorage.setItem("sessionType", sessionType);
			sessionStorage.setItem("id", this.store.idToken!);
            sessionStorage.setItem("access", this.store._rawAccessToken()!);
            sessionStorage.setItem("refresh", this.store.refreshToken);
            sessionStorage.setItem("info", JSON.stringify(this.store.lazyloadUserInfo));
        } else {
			sessionStorage.removeItem("sessionType");
            sessionStorage.removeItem("id");
            sessionStorage.removeItem("access");
            sessionStorage.removeItem("refresh");
            sessionStorage.removeItem("info");
        }
    }

	parseIdToken(): boolean {
		try {
			if (this.store.idToken !== "-" && this.store.idToken !== undefined) {
				const idToken = this.jwtHelperService.parseJWTtoken(this.store.idToken);
				const idTokenClaims = idToken.content;
	
				assertIDTokenClaims(idTokenClaims);
				this.store.givenName = idTokenClaims.given_name;
				this.store.familyName = idTokenClaims.family_name;
				this.store.email = idTokenClaims.email;
				this.store.sid = idTokenClaims.sid;
			} else {
				this.store.givenName = "Offline";
				this.store.familyName = "User";
				this.store.email = "no email";
				this.store.sid = "<unset>";
			}
			return true;
		} catch(err) {
			this.errorService.showErrorMessage("Invalid ID token given! " + err);
			return false;
		}
	}

	restoreSessionFromStore(): Promise<void> {
		return new Promise((res, rej) => {
			if (this.store.isLoggedIn) {
				res();
				return;
			}

			const rawIdToken = sessionStorage.getItem("id");
			const rawAccessToken = sessionStorage.getItem("access");
			const rawRefreshToken = sessionStorage.getItem("refresh");
			const userInfo = JSON.parse(sessionStorage.getItem("info") || "{}");

			if (rawIdToken !== null && rawAccessToken !== null && rawRefreshToken !== null && userInfo !== null) {
				this.store.idToken = rawIdToken;
				this.store.accessToken = rawAccessToken;
				this.store.refreshToken = rawRefreshToken;
				this.store.lazyloadUserInfo = userInfo;
				this.store.isLoggedIn = true;
				console.log("logged in !");
				res();
			} else {
				this.removeUserInformation();
				this.storeSessionInStore(SessionType.ONLINE);
				rej();
			}
			window.dispatchEvent(new Event("UserAuthenticated"));
		});
	}

	redirectClientToLoginPage(reason: string) {
        this.errorService.showErrorMessage(reason);
        this.router.navigateByUrl("/login");
    }
}
