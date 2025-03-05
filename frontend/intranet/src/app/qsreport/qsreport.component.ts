import { Component, computed, ElementRef, EventEmitter, inject, signal, Signal, ViewChild, WritableSignal } from '@angular/core';
import { ErrorlistService } from '../errorlist/errorlist.service';
import { IStringify, NO_HINT, SearchDropdownComponent } from '../search-dropdown/search-dropdown.component';
import { DatepickerComponent } from '../datepicker/datepicker.component';
import { ApiCompatibleProductionType, QsFarmerProductionCombination } from './qs-farmer-production-combinations';
import { ProductionUsageGroup, QsFarmerAnimalAgeUsageGroup } from './qs-farmer-production-age-mapping';
import { CategorizedItem, CategorizedList } from '../utilities/categorized-list';
import { BlockingoverlayComponent, OverlayButtonDesign } from '../blockingoverlay/blockingoverlay.component';
import { BackendService } from '../api/backend.service';
import { DrugUnit, ReportableDrug, DrugUnits, Farmer, DrugPackage, ApiInterfaceDrugsOut, ApiInterfaceFarmersOut, ApiInterfacePutPrescriptionRowsIn } from "../../../../../api_common/api_qs";
import { ApiInterfaceEmptyIn, ApiInterfaceEmptyOut } from '../../../../../api_common/backend_call';
import { ReactiveFormsModule, FormBuilder, Validators, AbstractControl, ValidationErrors } from '@angular/forms';
import { SessionService } from '../shared-service/session.service';

@Component({
	selector: 'app-qsreport',
	imports: [SearchDropdownComponent, DatepickerComponent, BlockingoverlayComponent, ReactiveFormsModule],
	templateUrl: './qsreport.component.html',
	styleUrl: './qsreport.component.scss'
})
export class QsreportComponent {

	static API_URL_DRUG = "https://internal.mittermeier-kraiburg.vet/module/qs/drugs"
	static API_URL_FARMER = "https://internal.mittermeier-kraiburg.vet/module/qs/farmers"
	static API_URL_POST_REPORT = "https://internal.mittermeier-kraiburg.vet/module/qs/report"

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
	selectedPackingForm: WritableSignal<DrugPackage | undefined> = signal(undefined);

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
	selectedUsageGroup: WritableSignal<ProductionUsageGroup | undefined> = signal(undefined);

	drugUnits: Signal<DrugUnit[]> = signal(DrugUnits.values());
	selectedDrugUnit: WritableSignal<DrugUnit | undefined> = signal(undefined);

	farmerSerializer: IStringify<Farmer> = { display: (farmer) => ({ text: farmer.name.replaceAll("  ", " "), hint: NO_HINT }) };
	farmerProductionTypeSerializer: IStringify<ApiCompatibleProductionType> = { display: (prodType) => ({ text: prodType.productionTypeName, hint: NO_HINT }) };
	usageGroupSerializer: IStringify<ProductionUsageGroup> = { display: (usageGroup) => ({ text: usageGroup.usageGroupName, hint: NO_HINT }) };
	drugSerializer: IStringify<CategorizedItem<ReportableDrug>> = {
		display: (reportableDrug) => ({
			text: reportableDrug.item.name + (reportableDrug.item.forms.length == 1 ? " - " + reportableDrug.item.forms[0].package : " ..."),
			hint: reportableDrug.category == this.DRUG_CATEGORY_OK ? { color: 'lightgreen', text: 'OK' } : { color: 'orange', text: 'WARN' }
		})
	};
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

		if (this.sessionService.qsVeterinaryName) {
			let control = this.qsFormGroup.controls["vetName"];
			control.setValue(this.sessionService.qsVeterinaryName || "<unknown>");
			control.disable();
		}
	}

	buildPatternThisAndPreviousYear() {
		let thisYear = new Date().getFullYear();
		let lastYear = thisYear - 1;
		return '^[0-3][0-9]\.[0-1][0-9]\.((' + thisYear + ')|(' + lastYear + '))$';
	}

	biggerThanZeroValidator (control: AbstractControl): ValidationErrors | null {
		const forbidden = parseFloat(control.value) <= 0;
		return forbidden ? { notAllowed: { value: control.value } } : null;
	};

	private formBuilder = inject(FormBuilder);
	qsFormGroup = this.formBuilder.group({
		vetName: ['', Validators.required],
		documentNumber: ['', Validators.required],
		deliveryDate: ['', [Validators.required, Validators.pattern(this.buildPatternThisAndPreviousYear())]],
		locationNumber: [''],
		productionType: [''],
		usageGroup: [''],
		animalCount: [0, Validators.required],
		drugZNR: ['', Validators.required],
		drugPID: ['', Validators.required],
		amount: [0, [Validators.required, this.biggerThanZeroValidator]],
		amountUnit: ['', Validators.required],
		applicationDuration: [0, Validators.required]
	});

	constructor(
		private errorlistService: ErrorlistService,
		private backendService: BackendService,
		private sessionService: SessionService
	) {
		this.loadApiData();
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
		this.selectedPackingForm.set(drugPacking);
	}

	submitForm() {
		if (this.qsFormGroup.valid) {
			this.backendService.authorizedBackendCall<ApiInterfacePutPrescriptionRowsIn, ApiInterfaceEmptyOut>(QsreportComponent.API_URL_POST_REPORT, {
				drugReport: {
					veterinary: this.qsFormGroup.controls["vetName"].value ?? "",
					deliveryDate: DatepickerComponent.parseDateGerman(this.qsFormGroup.controls["deliveryDate"].value ?? "") ?? new Date(),
					documentNumber: parseInt(this.qsFormGroup.controls["documentNumber"].value ?? "-1"),
					locationNumber: this.selectedFarmer()?.locationNumber ?? "",
					prescriptionRows: [
						{
							animalCount: this.qsFormGroup.controls["animalCount"].value ?? -1,
							animalGroup: this.selectedUsageGroup()?.usageGroup ?? -1,
							drugs: [
								{
									amount: this.qsFormGroup.controls["amount"].value ?? -1,
									amountUnit: this.selectedDrugUnit()?.id ?? -1,
									applicationDuration: this.qsFormGroup.controls["applicationDuration"].value ?? -1,
									approvalNumber: this.selectedDrug()?.item.znr ?? "",
									packageId: this.selectedPackingForm()?.pid ?? -1
								}
							]
						}
					]
				}
			});
		}
	}
}
