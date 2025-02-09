import { Component, computed, signal, Signal, WritableSignal } from '@angular/core';
import { ErrorlistService } from '../errorlist/errorlist.service';
import { IStringify, NO_HINT, SearchDropdownComponent } from '../search-dropdown/search-dropdown.component';
import { DatepickerComponent } from '../datepicker/datepicker.component';
import { ApiCompatibleProductionType, QsFarmerProductionCombination } from './qs-farmer-production-combinations';
import { ProductionUsageGroup, QsFarmerAnimalAgeUsageGroup } from './qs-farmer-production-age-mapping';
import { SessionService } from '../shared-service/session.service';
import { CategorizedItem, CategorizedList } from '../categorized-list';
import { BlockingoverlayComponent, OverlayButton, OverlayButtonDesign } from '../blockingoverlay/blockingoverlay.component';

@Component({
	selector: 'app-qsreport',
	imports: [SearchDropdownComponent, DatepickerComponent, BlockingoverlayComponent],
	templateUrl: './qsreport.component.html',
	styleUrl: './qsreport.component.scss'
})
export class QsreportComponent {

	static API_URL_DRUG = "https://internal.mittermeier-kraiburg.vet/module/qs/drugs"
	static API_URL_FARMER = "https://internal.mittermeier-kraiburg.vet/module/qs/farmers"

	DRUG_CATEGORY_OK = "moveta";
	DRUG_CATEGORY_WARN = "hit";

	drugErrorOverlayShown: WritableSignal<boolean> = signal(false);
	readonly OverlayButtonDesign: typeof OverlayButtonDesign = OverlayButtonDesign;
	drugErrorOverlayButtons = [{
		text: "OK",
		id: 1,
		design: OverlayButtonDesign.PRIMARY_COLORED
	}];


	reportableDrugList: WritableSignal<CategorizedList<ReportableDrug>> = signal(new CategorizedList<ReportableDrug>());
	selectedDrug: WritableSignal<CategorizedItem<ReportableDrug> | undefined> = signal(undefined);
	selectedDrugPackingForms: Signal<DrugPackage[]> = computed(() => {
		let drug = this.selectedDrug();
		if (drug !== undefined) {
			return drug.item.forms;
		}
		return [];
	});

	farmers: WritableSignal<Farmer[]> = signal([]);
	selectedFarmer: WritableSignal<Farmer | undefined> = signal(undefined);
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
	selectedProductionType: WritableSignal<ApiCompatibleProductionType | undefined> = signal(undefined);
	selectedProductionUsageGroups: Signal<ProductionUsageGroup[]> = computed(() => {
		let productionType = this.selectedProductionType();
		if (productionType !== undefined) {
			return QsFarmerAnimalAgeUsageGroup.getUsageGroupsBasedOnProductionType(productionType.productionType);
		}
		return [];
	});

	farmerSerializer: IStringify<Farmer> = { display: (farmer) => ({ text: farmer.name, hint: NO_HINT }) };
	farmerProductionTypeSerializer: IStringify<ApiCompatibleProductionType> = { display: (prodType) => ({ text: prodType.productionTypeName, hint: NO_HINT }) };
	usageGroupSerializer: IStringify<ProductionUsageGroup> = { display: (usageGroup) => ({ text: usageGroup.usageGroupName, hint: NO_HINT }) };
	drugSerializer: IStringify<CategorizedItem<ReportableDrug>> = { display: (reportableDrug) => ({
		text: reportableDrug.item.name + (reportableDrug.item.forms.length == 1 ? " - " + reportableDrug.item.forms[0].package : " ..."), 
		hint: reportableDrug.category == 'moveta' ? { color: 'lightgreen', text: 'OK' } : { color: 'orange', text: 'WARN' }
	})};
	drugPackingSerializer: IStringify<DrugPackage> = { display: (drugPackage) => ({ text: drugPackage.package, hint: NO_HINT }) };

	constructor(
		private errorlistService: ErrorlistService,
		private sessionService: SessionService
	) {
		fetch(QsreportComponent.API_URL_DRUG, {
			headers: { 'Authorization': 'Bearer ' + sessionService.accessToken }
		}).then(async resp => {
			const json = (await resp.json());
			if (resp.ok) {
				let reportableDrugsPrefered = json["content"]["prefered"];
				let reportableDrugsFallback = json["content"]["fallback"];

				const categorized = new CategorizedList<ReportableDrug>();
				categorized.init({ category: this.DRUG_CATEGORY_OK, items: reportableDrugsPrefered }, 
								{ category: this.DRUG_CATEGORY_WARN, items: reportableDrugsFallback });
				this.reportableDrugList.set(categorized);

				console.log("Loaded " + this.reportableDrugList().length + " drugs!");
			} else {
				throw new Error(json["error"]);
			}
		}).catch(e => {
			errorlistService.showErrorMessage("Error receiving list of reportable drugs: " + e);
		});

		fetch(QsreportComponent.API_URL_FARMER, {
			headers: { 'Authorization': 'Bearer ' + sessionService.accessToken }
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

	drugSelected(drug: CategorizedItem<ReportableDrug> | undefined) {
		if (drug?.category == this.DRUG_CATEGORY_WARN) {
			this.drugErrorOverlayShown.set(true);
		}
		this.selectedDrug.set(drug);
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