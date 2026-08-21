import { Injectable } from '@angular/core';
import { ApiInterfaceEmptyIn } from '../../../../../../api_common/backend_call';
import { Customer } from '../../../../../../api_common/generic_types/customer';
import { UserPermission } from '../../../../../../api_common/permission_types';
import { BackendService } from '../../api/backend.service';
import { ApiInterfaceEntitiesListOut } from '../../../../../../api_common/api_customers';
import { Business } from '../../../../../../api_common/generic_types/business';
import { Drug } from '../../../../../../api_common/generic_types/drug';

export type EntitiesBackendFetch = {
	customers: Customer[],
	businesses: Business[],
	drugs: Drug[],
	drugsExternal: Drug[]
};

@Injectable({
	providedIn: 'root'
})
export class EntitiesBackendService extends BackendService {

	API_URL_ENTITIES_BACKEND_SERVICE_URL = "/module/entities/entities";

	name(): string {
		return "Stammdaten";
	}

	modulePermission(): UserPermission | undefined {
		return UserPermission.ENTITIES_LIST;
	}

	fetchBackendData(): Promise<any> {
		return new Promise<EntitiesBackendFetch>((res, rej) => {
			let backendDat: EntitiesBackendFetch = {
				customers: [],
				businesses: [],
				drugs: [],
				drugsExternal: []
			};

			let loadEntities = this.authorizedBackendCall<ApiInterfaceEmptyIn, ApiInterfaceEntitiesListOut>(this.API_URL_ENTITIES_BACKEND_SERVICE_URL).then(dat => {
				dat.customers.forEach(customer => {
					if (customer.moveta.birthday) {
						customer.moveta.birthday = new Date(customer.moveta.birthday);
					}
				});
				backendDat.customers = dat.customers;
				backendDat.businesses = dat.businesses;
				backendDat.drugs = dat.drugs;
				backendDat.drugsExternal = dat.drugsExternal;
			}).catch(e => {
				this.getErrorlistService().showErrorMessage("Error receiving entities list from backend! " + e);
			});

			Promise.allSettled([loadEntities]).then(d => d.find(e => e.status == 'rejected') !== undefined ? rej() : res(backendDat));
		});
	}
}