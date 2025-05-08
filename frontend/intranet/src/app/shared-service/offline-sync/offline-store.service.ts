import { computed, Injectable, Signal } from '@angular/core';
import { OfflineModuleStore } from './offline-module-store';
import { ErrorlistService } from '../../errorlist/errorlist.service';
import { QsreportComponent } from '../../qsreport/qsreport.component';

@Injectable({
	providedIn: 'root'
})
export class OfflineStoreService {

	constructor(private errorlistService: ErrorlistService) {
		// Register all used offline stores here:
		this.register("qs", "QS-Meldung", "/qs");
		this.loadAllStores();
	}

	private offlineModuleStores: OfflineModuleStore[] = [];

	totalEntryCount: Signal<number> = computed(() => this.offlineModuleStores.map(store => store.entryCount()).reduce((prev, curr) => prev + curr, 0));

	register(module: string, displayName: string, path: string) {
		let moduleStore = this.offlineModuleStores.find(s => s.name == module);
		if (moduleStore == undefined) {
			moduleStore = new OfflineModuleStore(this.keyPrefix(), module, displayName, path);
			this.offlineModuleStores.push(moduleStore);
		} else {
			this.errorlistService.showErrorMessage("OfflineStore tried to register second time: " + module);
		}
	}

	getStore(module: string): OfflineModuleStore | undefined {
		let moduleStore = this.offlineModuleStores.find(s => s.name == module);
		if (moduleStore == undefined) {
			this.errorlistService.showErrorMessage("Tried to get store that is not registered: " + module);
			return undefined;
		} else {
			return moduleStore;
		}
	}

	keyPrefix() {
		return "offline-";
	}

	loadAllStores() {
		for (let i = 0; i < localStorage.length; i++) {
			let key = localStorage.key(i);
			if (key && key.startsWith(this.keyPrefix())) {
				let offlineStoreName = key.split(this.keyPrefix())[1];
				console.log("Loading offline store " + offlineStoreName);
				this.getStore(offlineStoreName);
			}
		}
	}

	get moduleStores() { return this.offlineModuleStores; }
}
