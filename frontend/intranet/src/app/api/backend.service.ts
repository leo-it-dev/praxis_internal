import { Injectable } from '@angular/core';
import { SessionService } from '../shared-service/session.service';
import { ErrorlistService } from '../errorlist/errorlist.service';

@Injectable({
	providedIn: 'root'
})
export class BackendService {

	constructor(
		private sessionService: SessionService,
		private errorlistService: ErrorlistService
	) { };

	authorizedBackendCall(url: string, body: BodyInit|undefined = undefined): Promise<{[key:string]:any}> {
		return new Promise((res, rej) => {
			this.sessionService.accessToken.then((accessToken) => {
				fetch(url, {
					headers: { 'Authorization': 'Bearer ' + accessToken },
					body: body
				}).then(async resp => {
					const json = (await resp.json());
					if (resp.ok) {
						res(json['content']);
					} else if (resp.status == 401) { // Unauthorized. There seems to be a problem with our access (session) token.
						this.sessionService.unauthorizeSession("Backend service reported a problem with your session! You have been logged out!");
					} else {
						throw new Error(json["error"]);
					}
				}).catch(e => {
					this.errorlistService.showErrorMessage("Error performing backend call: " + e);
					rej(e);
				});
			});
		});
	}
}
