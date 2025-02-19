import { Injectable } from '@angular/core';
import { SessionService } from '../shared-service/session.service';
import { ErrorlistService } from '../errorlist/errorlist.service';
import { ApiModuleBody, ApiModuleInterfaceB2F, ApiModuleInterfaceF2B } from '../../../../../api_common/backend_call'
import { Injector } from '@angular/core';

@Injectable({
	providedIn: 'root'
})
export class BackendService {

	constructor(
		private errorlistService: ErrorlistService,
		private injector: Injector
	) { };

	private sessionService!: SessionService;

	getSessionService() {
		if (!this.sessionService) {
			this.sessionService = this.injector.get(SessionService);
		}
		return this.sessionService;
	}

	anonymousBackendCall<REQ extends ApiModuleInterfaceF2B, RES extends ApiModuleInterfaceB2F>(url: string, body: REQ|undefined = undefined): Promise<RES> {
		return new Promise((res, rej) => {
			fetch(url, {
				method: body === undefined ? "GET" : "POST",
				body: JSON.stringify(body),
				headers: {
					'Content-Type': 'application/json',
					'Accept': 'application/json'
				}
			}).then(async resp => {
				const json = (await resp.json()) as ApiModuleBody;
				if (resp.ok) {
					res(json.content as RES);
				} else {
					throw new Error(resp.status + ": " + json.error);
				}
			}).catch(e => {
				this.errorlistService.showErrorMessage("Error performing backend call: " + e);
				rej(e);
			});
		});
	}

	authorizedBackendCall<REQ extends ApiModuleInterfaceF2B, RES extends ApiModuleInterfaceB2F>(url: string, body: REQ|undefined = undefined): Promise<RES> {
		return new Promise((res, rej) => {
			this.getSessionService().accessToken.then((accessToken) => {
				fetch(url, {
					method: body === undefined ? "GET" : "POST",
					body: JSON.stringify(body),
					headers: {
						'Content-Type': 'application/json',
						'Accept': 'application/json',
						'Authorization': 'Bearer ' + accessToken
					}
				}).then(async resp => {
					const json = (await resp.json()) as ApiModuleBody;
					if (resp.ok) {
						res(json.content as RES);
					} else if (resp.status == 401) { // Unauthorized. There seems to be a problem with our access (session) token.
						this.getSessionService().unauthorizeSession("Backend service reported a problem with your session! You have been logged out!");
					} else {
						throw new Error(resp.status + ": " + json.error);
					}
				}).catch(e => {
					this.errorlistService.showErrorMessage("Error performing backend call: " + e);
					rej(e);
				});
			});
		});
	}
}
