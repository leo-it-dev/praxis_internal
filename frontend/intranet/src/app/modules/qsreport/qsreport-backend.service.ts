import { Injectable } from '@angular/core';
import { ApiInterfaceFarmersOut, Farmer } from '../../../../../../api_common/api_qs';
import { ApiInterfaceEmptyIn } from '../../../../../../api_common/backend_call';
import { UserPermission } from '../../../../../../api_common/permission_types';
import { BackendService } from '../../api/backend.service';

export type QsBackendFetch = {
	farmers: Farmer[]
}

@Injectable({
	providedIn: 'root'
})
export class QsreportBackendService extends BackendService {

	API_URL_DRUG = "/module/qs/drugs"
	API_URL_FARMER = "/module/qs/farmers"

	name(): string {
		return "QS-Api";
	}

	modulePermission(): UserPermission {
		return UserPermission.QS_REPORT;
	}

	async fetchBackendData(): Promise<QsBackendFetch> {
		return new Promise<QsBackendFetch>((res, rej) => {
			let backendDat: QsBackendFetch = {
				farmers: []
			};

			let loadFarmers = this.authorizedBackendCall<ApiInterfaceEmptyIn, ApiInterfaceFarmersOut>(this.API_URL_FARMER).then(dat => {
				backendDat.farmers = dat.farmers;
			}).catch(e => {
				this.getErrorlistService().showErrorMessage("Error receiving list of reportable drugs: " + e);
			});

			Promise.allSettled([loadFarmers]).then(d => d.find(e => e.status == 'rejected') !== undefined ? rej() : res(backendDat));
		});
	}
}
