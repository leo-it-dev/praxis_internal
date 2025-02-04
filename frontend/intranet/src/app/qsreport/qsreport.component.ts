import { Component, computed, signal, Signal, WritableSignal } from '@angular/core';
import { ErrorlistService } from '../errorlist/errorlist.service';
import { IStringify, SearchDropdownComponent } from '../search-dropdown/search-dropdown.component';
import { DatepickerComponent } from '../datepicker/datepicker.component';
import { ApiCompatibleProductionType, QsFarmerProductionCombination } from './qs-farmer-production-combinations';
import { ProductionUsageGroup, QsFarmerAnimalAgeUsageGroup } from './qs-farmer-production-age-mapping';
import { SessionService } from '../shared-service/session.service';

@Component({
	selector: 'app-qsreport',
	imports: [SearchDropdownComponent, DatepickerComponent],
	templateUrl: './qsreport.component.html',
	styleUrl: './qsreport.component.scss'
})
export class QsreportComponent {

    static API_URL_DRUG = "https://internal.mittermeier-kraiburg.vet/module/qs/drugs"
    static API_URL_FARMER = "https://internal.mittermeier-kraiburg.vet/module/qs/farmers"

	reportableDrugList: WritableSignal<ReportableDrug[]> = signal([]);
	selectedDrug: WritableSignal<ReportableDrug|undefined> = signal(undefined);
	selectedDrugPackingForms: Signal<DrugPackage[]> = computed(() => {
		let drug = this.selectedDrug();
		if (drug !== undefined) {
			return drug.forms;
		}
		return [];
	});

	farmers: WritableSignal<Farmer[]> = signal([]);
	selectedFarmer: WritableSignal<Farmer|undefined> = signal(undefined);
	selectedFarmerProductionTypes: Signal<ApiCompatibleProductionType[]> = computed(() => {
		let farmer = this.selectedFarmer();
		if (farmer !== undefined) {
			let apiComptaibleProductionTypes: ApiCompatibleProductionType[] = [];
			for (let productionType of farmer.productionType) {
				apiComptaibleProductionTypes = apiComptaibleProductionTypes.concat(QsFarmerProductionCombination.splitProductionIdIntoAPICompatibleIDs(productionType));
			}
			return apiComptaibleProductionTypes;
		}
		return [];
	});
	selectedProductionType: WritableSignal<ApiCompatibleProductionType|undefined> = signal(undefined);
	selectedProductionUsageGroups: Signal<ProductionUsageGroup[]> = computed(() => {
		let productionType = this.selectedProductionType();
		if (productionType !== undefined) {
			return QsFarmerAnimalAgeUsageGroup.getUsageGroupsBasedOnProductionType(productionType.productionType);
		}
		return [];
	});

	farmerSerializer: IStringify<Farmer> = {display: (farmer) => farmer.name};
	farmerProductionTypeSerializer: IStringify<ApiCompatibleProductionType> = {display: (prodType) => prodType.productionTypeName};
	usageGroupSerializer: IStringify<ProductionUsageGroup> = {display: (usageGroup) => usageGroup.usageGroupName};
	drugSerializer: IStringify<ReportableDrug> = {display: (reportableDrug) => reportableDrug.name + (reportableDrug.forms.length == 1 ? " - " + reportableDrug.forms[0].package : " ...")};
	drugPackingSerializer: IStringify<DrugPackage> = {display: (drugPackage) => drugPackage.package};

	constructor(
		private errorlistService: ErrorlistService,
		private sessionService: SessionService
	) {
		fetch(QsreportComponent.API_URL_DRUG, {
			headers: {'Authorization': 'Bearer ' + sessionService.accessToken}
		}).then(async resp => {
			const json = (await resp.json());
			if (resp.ok) {
				let reportableDrugsPrefered = json["content"]["prefered"];
				let reportableDrugsFallback = json["content"]["fallback"];

				this.reportableDrugList.set(reportableDrugsPrefered.concat(reportableDrugsFallback));
				console.log("Loaded " + this.reportableDrugList().length + " drugs!");
			} else {
				throw new Error(json["error"]);
			}
		}).catch(e => {
			errorlistService.showErrorMessage("Error receiving list of reportable drugs: " + e);
		});

		fetch(QsreportComponent.API_URL_FARMER, {
			headers: {'Authorization': 'Bearer ' + sessionService.accessToken}
		}).then(async resp => {
			const json = (await resp.json());
			if (resp.ok) {
				this.farmers.set(json["content"]);
				console.log("Loaded " + this.farmers().length + " farmers!");
			} else {
				throw new Error(json["error"]);
			}
		}).catch(e => {
			errorlistService.showErrorMessage("Error receiving list of reportable drugs: " + e);
		});
	}

	drugPackingFormSelected(drugPacking?: DrugPackage) {
		if (drugPacking) {
			console.log("Drug packing type selected: " + drugPacking.package);
		} else {
			console.log("Drug packing type unselected!");
		}
	}

	usageGroupSelected(usageGroup?: ProductionUsageGroup) {
		if (usageGroup) {
			console.log("Usage Group selected: " + usageGroup.usageGroupName);
		} else {
			console.log("Usage Group unselected!");
		}
	}
}

type DrugPackage = {
    package: string;
	pid: number;
}

export type ReportableDrug = {
    znr: string;
    name: string;
    forms: Array<DrugPackage>;
};

export type Farmer = {
    name: string; // Eindeutige Identifikation des Tierhalters in VetProof
    locationNumber: string; // VVVO-Nummer des Tierhalters
    productionType: number[]; // Produktionsart laut QS
    qsNumber: string; // QS-Nummer des Tierhalters
    vpId: number; // Eindeutige Identifikation des Tierhalters in VetProof
};