import { Injectable } from '@angular/core';
import { ApiInterfaceEmptyIn } from '../../../../../../api_common/backend_call';
import { UserPermission } from '../../../../../../api_common/permission_types';
import { BackendService } from '../../api/backend.service';
import { ApiInterfaceTravelExpensesMetaOut, TravelExpenseStage } from '../../../../../../api_common/api_travelexpenses';

export type TravelExpensesBackendFetch = {
	centerOfMap: {
		lat: number,
		lon: number
	},
	travelExpenseStages: TravelExpenseStage[],
};

@Injectable({
	providedIn: 'root'
})
export class TravelexpensesBackendService extends BackendService {

	API_URL_TRAVEL_EXPENSES_CENTER_OF_EARTH = "/module/travel-expenses/travelmeta";
	
	name(): string {
		return "Anfahrtskosten";
	}
	
	modulePermission(): UserPermission | undefined {
		return UserPermission.TRAVEL_EXPENSES_MAP;
	}
	
	fetchBackendData(): Promise<any> {
		return new Promise<TravelExpensesBackendFetch>((res, rej) => {
			let backendDat: TravelExpensesBackendFetch = {
				centerOfMap: {
					lat: 0,
					lon: 0
				},
				travelExpenseStages: []
			};

			let loadMetaData = this.authorizedBackendCall<ApiInterfaceEmptyIn, ApiInterfaceTravelExpensesMetaOut>(this.API_URL_TRAVEL_EXPENSES_CENTER_OF_EARTH).then(dat => {
				backendDat.centerOfMap = dat.centerOfEarth;
				backendDat.travelExpenseStages = dat.travelExpenseStages;
			}).catch(e => {
				this.getErrorlistService().showErrorMessage("Error receiving meta data of travel expenses: " + e);
			});

			Promise.allSettled([loadMetaData]).then(d => d.find(e => e.status == 'rejected') !== undefined ? rej() : res(backendDat));
		});
	}
}