import { Injectable, signal, WritableSignal } from '@angular/core';
import { QsreportComponent } from '../qsreport/qsreport.component';
import { QsreportBackendService } from '../qsreport/qsreport-backend.service';

export interface IModule {
	fetchBackendData(): Promise<any>;
	name(): string;
}

export type Module = {
	imodule: IModule;
	backendCacheUpdateInProgress: WritableSignal<boolean>;
	backendCacheUpdateResult: WritableSignal<boolean>;
}
 
@Injectable({
	providedIn: 'root'
})
export class ModuleService {

	private _modules: Module[] = [];

	constructor(
		private qsreportBackendModule: QsreportBackendService
	) {
		// Append future modules here to auto-cache backend information upon online-login.
		let modules: IModule[] = [
			qsreportBackendModule
		];


		modules.forEach(m => this._modules.push({
			imodule: m,
			backendCacheUpdateInProgress: signal(false),
			backendCacheUpdateResult: signal(false)
		}));
	}

	updateBackendCaches(): Promise<void> {
		return new Promise((res, rej) => {
			console.log("update backend caches!!");
			this._modules.forEach(m => m.backendCacheUpdateInProgress.set(true));

			Promise.allSettled(this._modules.map(m => 
				m.imodule.fetchBackendData().then(() => {
					m.backendCacheUpdateInProgress.set(false);
					m.backendCacheUpdateResult.set(true);
				}).catch(() => {
					m.backendCacheUpdateInProgress.set(false);
					m.backendCacheUpdateResult.set(false);
			}))).then((dat => dat.find(f => f.status == 'rejected') == undefined ? res() : rej()));
		});
	}

	backendCacheUpdateFinished() {
		return this._modules.map(m => !m.backendCacheUpdateInProgress()).find(finished => !finished) == undefined;
	}

	get modules(): Module[] {
		return this._modules;
	}
}
