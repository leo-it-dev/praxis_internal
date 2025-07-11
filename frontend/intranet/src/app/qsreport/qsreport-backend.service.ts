import { Injectable } from '@angular/core';
import { ApiInterfaceDrugsOut, ApiInterfaceFarmersOut, Farmer, ReportableDrug } from '../../../../../api_common/api_qs';
import { ApiInterfaceEmptyIn } from '../../../../../api_common/backend_call';
import { BackendService } from '../api/backend.service';
import { CategorizedList } from '../utilities/categorized-list';
import { DRUG_CATEGORY_OK, DRUG_CATEGORY_WARN } from './qsreport.component';
import { IModule } from '../module/module.service';
import { ErrorlistService } from '../timed-popups/popuplist/errorlist.service';

export type QsBackendFetch = {
	drugs: CategorizedList<ReportableDrug>;
	farmers: Farmer[]
}

@Injectable({
	providedIn: 'root'
})
export class QsreportBackendService implements IModule {

	API_URL_DRUG = "/module/qs/drugs"
	API_URL_FARMER = "/module/qs/farmers"

	constructor(private backendService: BackendService,
		private errorlistService: ErrorlistService
	) {}
	
	name(): string {
		return "QS-Api";
	}

	async fetchBackendData(): Promise<QsBackendFetch> {
		return new Promise<QsBackendFetch>((res, rej) => {
			let backendDat: QsBackendFetch = {
				drugs: new CategorizedList<ReportableDrug>(),
				farmers: []
			};

			let loadDrugs = this.backendService.authorizedBackendCall<ApiInterfaceEmptyIn, ApiInterfaceDrugsOut>(this.API_URL_DRUG).then(dat => {
				backendDat.drugs.init({ category: DRUG_CATEGORY_OK, items: dat.prefered }, { category: DRUG_CATEGORY_WARN, items: dat.fallback });
			}).catch(e => {
				this.errorlistService.showErrorMessage("Error receiving list of reportable drugs: " + e);
			});

			let loadFarmers = this.backendService.authorizedBackendCall<ApiInterfaceEmptyIn, ApiInterfaceFarmersOut>(this.API_URL_FARMER).then(dat => {
				backendDat.farmers = dat.farmers;
			}).catch(e => {
				this.errorlistService.showErrorMessage("Error receiving list of reportable drugs: " + e);
			});

			Promise.allSettled([loadDrugs, loadFarmers]).then(d => d.find(e => e.status == 'rejected') !== undefined ? rej() : res(backendDat));
		});
	}

}
