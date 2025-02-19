import { Component, computed, ElementRef, EventEmitter, signal, Signal, ViewChild, WritableSignal } from '@angular/core';
import { ErrorlistService } from '../errorlist/errorlist.service';
import { IStringify, NO_HINT, SearchDropdownComponent } from '../search-dropdown/search-dropdown.component';
import { DatepickerComponent } from '../datepicker/datepicker.component';
import { ApiCompatibleProductionType, QsFarmerProductionCombination } from './qs-farmer-production-combinations';
import { ProductionUsageGroup, QsFarmerAnimalAgeUsageGroup } from './qs-farmer-production-age-mapping';
import { CategorizedItem, CategorizedList } from '../utilities/categorized-list';
import { BlockingoverlayComponent, OverlayButtonDesign } from '../blockingoverlay/blockingoverlay.component';
import { BackendService } from '../api/backend.service';
import { DrugUnit, ReportableDrug, DrugUnits, Farmer, DrugPackage, ApiInterfaceDrugsOut, ApiInterfaceFarmersOut } from "../../../../../api_common/api_qs";
import { ApiInterfaceEmptyIn } from '../../../../../api_common/backend_call';

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

	@ViewChild('drugUnitDOM') drugUnitDOM?: SearchDropdownComponent<DrugUnit>;

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

	drugUnits: Signal<DrugUnit[]> = signal(DrugUnits.values());

	farmerSerializer: IStringify<Farmer> = { display: (farmer) => ({ text: farmer.name.replaceAll("  ", " "), hint: NO_HINT }) };
	farmerProductionTypeSerializer: IStringify<ApiCompatibleProductionType> = { display: (prodType) => ({ text: prodType.productionTypeName, hint: NO_HINT }) };
	usageGroupSerializer: IStringify<ProductionUsageGroup> = { display: (usageGroup) => ({ text: usageGroup.usageGroupName, hint: NO_HINT }) };
	drugSerializer: IStringify<CategorizedItem<ReportableDrug>> = { display: (reportableDrug) => ({
		text: reportableDrug.item.name + (reportableDrug.item.forms.length == 1 ? " - " + reportableDrug.item.forms[0].package : " ..."), 
		hint: reportableDrug.category == 'moveta' ? { color: 'lightgreen', text: 'OK' } : { color: 'orange', text: 'WARN' }
	})};
	drugPackingSerializer: IStringify<DrugPackage> = { display: (drugPackage) => ({ text: drugPackage.package, hint: NO_HINT }) };
	drugUnitSerializer: IStringify<DrugUnit> = { display: (drugUnit) => ({ text: drugUnit.name, hint: NO_HINT }) };

	async loadApiData() {
		this.backendService.authorizedBackendCall<ApiInterfaceEmptyIn, ApiInterfaceDrugsOut>(QsreportComponent.API_URL_DRUG).then(dat => {
			const categorized = new CategorizedList<ReportableDrug>();
			categorized.init({ category: this.DRUG_CATEGORY_OK, items: dat.prefered }, 
							{ category: this.DRUG_CATEGORY_WARN, items: dat.fallback });
			this.reportableDrugList.set(categorized);
			console.log("Loaded " + this.reportableDrugList().length + " drugs!");
		}).catch(e => {
			this.errorlistService.showErrorMessage("Error receiving list of reportable drugs: " + e);
		});

		this.backendService.authorizedBackendCall<ApiInterfaceEmptyIn, ApiInterfaceFarmersOut>(QsreportComponent.API_URL_FARMER).then(dat => {
			this.farmers.set(dat.farmers);
			console.log("Loaded " + this.farmers().length + " farmers!");
		}).catch(e => {
			this.errorlistService.showErrorMessage("Error receiving list of reportable drugs: " + e);
		});
	}

	constructor(
		private errorlistService: ErrorlistService,
		private backendService: BackendService
	) {
		this.loadApiData();
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

	drugPackingFormSelected(drugPacking?: DrugPackage) {
		if (drugPacking) {
			console.log("Drug packing type selected: " + drugPacking.package);
			if (drugPacking.unitSuggestion) {
				let unitQS = DrugUnits.values().find(u => u.id == drugPacking.unitSuggestion.id && u.name == drugPacking.unitSuggestion.name);
				this.drugUnitDOM?.selectItemExt(unitQS);
				console.log(unitQS);
			}
		} else {
			this.drugUnitDOM?.selectItemExt(undefined);
			console.log("Drug packing type unselected!");
		}
	}

	drugUnitSelected(drugUnit?: DrugUnit) {
		console.log(drugUnit);
	}
}
