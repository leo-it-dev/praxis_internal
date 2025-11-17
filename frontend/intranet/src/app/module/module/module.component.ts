import { AfterViewInit, Component, inject, Type } from '@angular/core';
import { SessionProviderService } from '../../shared-service/session/session-provider.service';
import { BackendService } from '../../api/backend.service';

@Component({
	selector: 'app-module',
	imports: [],
	templateUrl: './module.component.html',
	styleUrl: './module.component.scss'
})
export abstract class ModuleComponent implements AfterViewInit {

	private _sessionService: SessionProviderService;
	private _backendService: BackendService;

	constructor(protected _backendServiceType: Type<BackendService>) {
		this._backendService = inject(_backendServiceType);
		this._sessionService = inject(SessionProviderService);
	}

	ngAfterViewInit(): void {
		const requiredPermission = this._backendService.modulePermission();
		const permissionStore = this._sessionService.store.lazyloadUserInfo?.permissions;

		if (!this._sessionService.store.isLoggedIn) {
			this._sessionService.redirectClientToLoginPage("This service requires you to be logged in!");
		}
		if (requiredPermission !== undefined && (permissionStore == undefined || !permissionStore.userHasPermission(requiredPermission))) {
			this._sessionService.redirectClientToLoginPage("You don't have permission to use this service!");
		}

		this.afterViewInit();
	}

	getSessionService() {
		return this._sessionService;
	}
	getBackendService() {
		return this._backendService;
	}

	abstract afterViewInit(): void;
}
