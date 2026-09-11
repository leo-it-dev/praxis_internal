import { Injectable } from '@angular/core';
import { UserPermission } from '../../../../../api_common/permission_types';
import { BackendService } from '../api/backend.service';
import { EntitiesBackendService } from '../modules/entities/entities-backend.service';
import { LdapqueryBackendService } from '../modules/ldapquery/ldapquery-backend.service';
import { NewsBackendService } from '../modules/news/news-backend.service';
import { QsreportBackendService } from '../modules/qsreport/qsreport-backend.service';
import { TravelexpensesBackendService } from '../modules/travelexpenses/travelexpenses-backend.service';

export interface IModule {
	fetchBackendDataFilter(): Promise<any>;
	fetchBackendData(): Promise<any>;
	name(): string;
	modulePermission(): UserPermission | undefined;
	updateBackendCache(): Promise<void>;
	isBackendCacheUpdateInProgress(): boolean;
	getBackendCacheUpdateResult(): boolean;
	isBackendCacheUpdatePlanned(): boolean;
	clearBackendCacheUpdatePlanFlag(): void;
}

@Injectable({
	providedIn: 'root'
})
export class ModuleService {

	private _modules: IModule[] = [];

	constructor(
		private qsreportBackendModule: QsreportBackendService,
		private ldapqueryBackendModule: LdapqueryBackendService,
		private newsBackendModule: NewsBackendService,
		private travelExpensesModule: TravelexpensesBackendService,
		private entitiesListModule: EntitiesBackendService
	) {
		// Append future modules here to auto-cache backend information upon online-login.
		let modules: BackendService[] = [
			entitiesListModule,
			qsreportBackendModule,
			ldapqueryBackendModule,
			newsBackendModule,
			travelExpensesModule
		];
		this._modules = modules;
	}

	updateBackendCaches(): Promise<void> {
		return new Promise((res, rej) => {
			console.log("update backend caches!!");
			Promise.allSettled(this._modules.map(m => m.updateBackendCache())).then((dat => dat.find(f => f.status == 'rejected') == undefined ? res() : rej()));
		});
	}

	backendCacheUpdateFinished() {
		return this._modules.map(m => !m.isBackendCacheUpdateInProgress()).find(finished => !finished) == undefined;
	}

	clearBackendUpdateCachePlanning() {
		this._modules.forEach(m => m.clearBackendCacheUpdatePlanFlag());
	}

	get modules(): IModule[] {
		return this._modules;
	}
}
