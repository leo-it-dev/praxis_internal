import { Injectable, Injector, signal, WritableSignal } from '@angular/core';
import { ApiModuleBody, ApiModuleInterfaceB2F, ApiModuleInterfaceF2B } from '../../../../../api_common/backend_call';
import { SessionProviderService, SessionType } from '../shared-service/session/session-provider.service';
import { OfflineCacheService } from '../shared-service/offline-cache.service';
import { ErrorlistService } from '../timed-popups/popuplist/errorlist.service';
import { IModule } from '../module/module.service';
import { UserPermission } from '../../../../../api_common/permission_types';

@Injectable({
	providedIn: 'root'
})
export abstract class BackendService implements IModule {

	private backendCacheUpdateInProgress: WritableSignal<boolean> = signal(false);
	private backendCacheUpdateResult: WritableSignal<boolean> = signal(false);
	private backendCacheUpdatePlanned: WritableSignal<boolean> = signal(false);

	constructor(
		private offlineCacheService: OfflineCacheService,
		private injector: Injector
	) { };

	private sessionService!: SessionProviderService;
	private errorlistService!: ErrorlistService;

	getSessionService() {
		if (this.sessionService == undefined) {
			this.sessionService = this.injector.get(SessionProviderService);
		}
		return this.sessionService;
	}

	getErrorlistService() {
		if (this.errorlistService == undefined) {
			this.errorlistService = this.injector.get(ErrorlistService);
		}
		return this.errorlistService;
	}

	userHasPermission() {
		return this.getSessionService().store.lazyloadUserInfo?.permissions.userHasPermission(this.modulePermission());
	}

	anonymousBackendCall<REQ extends ApiModuleInterfaceF2B, RES extends ApiModuleInterfaceB2F>(url: string, body: REQ|undefined = undefined): Promise<RES> {
		return new Promise((res, rej) => {
			fetch(document.location.origin + url, {
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
				this.getErrorlistService().showErrorMessage("Error performing backend call: " + e);
				rej(e);
			});
		});
	}

	authorizedBackendCall<REQ extends ApiModuleInterfaceF2B, RES extends ApiModuleInterfaceB2F>(url: string, body: REQ|undefined = undefined): Promise<RES> {
		return new Promise((res, rej) => {
			if (this.getSessionService().getSessionType() == SessionType.ONLINE) {
				this.getSessionService().store.accessToken.then((accessToken) => {
					fetch(document.location.origin + url, {
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
							throw new Error("Error during online backend request: " + resp.status + ": " + json.error);
						}
					}).catch(e => {
						this.getErrorlistService().showErrorMessage("Error performing backend call: " + e);
						rej(e);
					});
				});
			} else {
				// We don't have a valid online session. Therefore we can't perform authorized backend calls.
				// We must use the backend calls cached from the PWA using the service worker.
				// Let's access the browser's cache and search for a valid entry for the requested URL.
				this.offlineCacheService.getFromAngularSWCache(url).then(async resp => {
					const json = (await resp.json()) as ApiModuleBody;
					if (resp.ok) {
						res(json.content as RES);
					} else {
						throw new Error("Error checking cache-based backend call: " + resp.status + ": " + json.error);
					}
				}).catch(e => {
					this.getErrorlistService().showErrorMessage("Error receiving cached backend call: " + e);
					rej(e);
				});
			}
		});
	}

	fetchBackendDataFilter(): Promise<any> {
		if (this.getSessionService().store.lazyloadUserInfo?.permissions.userHasPermission(this.modulePermission())) {
			return this.fetchBackendData();
		} else {
			return Promise.resolve();
		}
	}

	updateBackendCache(): Promise<void> {
		return new Promise((res, rej) => {
			console.log("updating backend caches: ", this.name());
			this.backendCacheUpdatePlanned.set(true);
			this.backendCacheUpdateInProgress.set(true);

			this.fetchBackendDataFilter().then(() => {
				this.backendCacheUpdateInProgress.set(false);
				this.backendCacheUpdateResult.set(true);
				res();
			}).catch(() => {
				this.backendCacheUpdateInProgress.set(false);
				this.backendCacheUpdateResult.set(false);
				rej();
			});
		});
	}

	isBackendCacheUpdateInProgress(): boolean {
		return this.backendCacheUpdateInProgress();
	}
	getBackendCacheUpdateResult(): boolean {
		return this.backendCacheUpdateResult();
	}
	isBackendCacheUpdatePlanned(): boolean {
		return this.backendCacheUpdatePlanned();
	}
	clearBackendCacheUpdatePlanFlag(): void {
		this.backendCacheUpdatePlanned.set(false);
	}

	abstract fetchBackendData(): Promise<any>;
	abstract modulePermission(): UserPermission | undefined;
	abstract name(): string;
}
