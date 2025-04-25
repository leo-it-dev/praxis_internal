import { Component, computed, EventEmitter, inject, Injector, input, Input, Output, Signal, signal, ViewChild, WritableSignal } from '@angular/core';
import { AbstractControl, FormBuilder, FormControl, NgControl, ReactiveFormsModule, ValidationErrors, Validators } from '@angular/forms';
import { DrugPackage, DrugUnit, DrugUnits, Farmer, PrescriptionRow, ReportableDrug } from '../../../../../../api_common/api_qs';
import { IStringify, NO_HINT, SearchDropdownComponent } from '../../search-dropdown/search-dropdown.component';
import { computedIsUpdated } from '../../utilities/angular-util';
import { CategorizedItem, CategorizedList } from '../../utilities/categorized-list';
import { ProductionUsageGroup, QsFarmerAnimalAgeUsageGroup } from '../qs-farmer-production-age-mapping';
import { ApiCompatibleProductionType, QsFarmerProductionCombination } from '../qs-farmer-production-combinations';
import { DRUG_CATEGORY_OK, DRUG_CATEGORY_WARN, HINT_OK, HINT_WARN } from '../qsreport.component';
import { toSignal } from '@angular/core/rxjs-interop'

@Component({
	selector: 'app-prescription-row',
	imports: [SearchDropdownComponent, ReactiveFormsModule],
	templateUrl: './prescription-row.component.html',
	styleUrl: './prescription-row.component.scss'
})
export class PrescriptionRowComponent {

	@ViewChild('drugUnitDOM') drugUnitDOM?: SearchDropdownComponent<DrugUnit>;
	@ViewChild('farmerDropdown') farmerDropdown?: SearchDropdownComponent<Farmer>;
	@ViewChild('productionDropdown') productionDropdown?: SearchDropdownComponent<ApiCompatibleProductionType>;
	@ViewChild('usageDropdown') usageDropdown?: SearchDropdownComponent<ProductionUsageGroup>;
	@ViewChild('drugDropdown') drugDropdown?: SearchDropdownComponent<ReportableDrug>;
	@ViewChild('packingDropdown') packingDropdown?: SearchDropdownComponent<DrugPackage>;

	@Input({ required: true }) 	farmers: Farmer[] = [];
	@Input({ required: true })	selectedFarmer: Signal<Farmer | undefined | null> = signal(undefined);
	@Input({ required: true }) 	reportableDrugList: CategorizedList<ReportableDrug> = new CategorizedList<ReportableDrug>();
	@Output("drugOverlayShown")	drugErrorOverlayShown: EventEmitter<ReportableDrug|undefined> = new EventEmitter<ReportableDrug|undefined>();
	@Output("addRow") 			addRow: EventEmitter<void> = new EventEmitter<void>();
	@Output("deleteRow") 		deleteRow: EventEmitter<void> = new EventEmitter<void>();

	injector: Injector;

	constructor(injector: Injector,
		private controlDir: NgControl
	) {
		this.injector = injector;
		controlDir.valueAccessor = this;

		this.qsFormGroup.valueChanges.subscribe(value => {
			if (this.onChangeValidationCallback) {
				this.onChangeValidationCallback(this.qsFormGroup.valid ? this.serializeFormToObject() : undefined);
			}
		});
		this.selectedProductionType = toSignal(this.qsFormGroup.controls["productionType"].valueChanges);
		this.selectedUsageGroup = toSignal(this.qsFormGroup.controls["usageGroup"].valueChanges);
		this.selectedDrugUnit = toSignal(this.qsFormGroup.controls["amountUnit"].valueChanges);
		this.selectedDrug = toSignal(this.qsFormGroup.controls["drugZNR"].valueChanges);
		this.selectedPackingForm = toSignal(this.qsFormGroup.controls["drugPID"].valueChanges);
	}

	// Constants
	drugUnits: DrugUnit[] = Object.values(DrugUnits);

	// DOM Bindings
	selectedProductionType: Signal<ApiCompatibleProductionType|null|undefined>;
	selectedUsageGroup: Signal<ProductionUsageGroup | null | undefined>;
	selectedDrugUnit: Signal<DrugUnit | null | undefined>;
	selectedDrug: Signal<CategorizedItem<ReportableDrug> | null | undefined>;
	selectedPackingForm: Signal<DrugPackage | null | undefined>;

	// Computations
	selectedFarmerProductionTypes: Signal<ApiCompatibleProductionType[]> = computed(() => {
		if (this.selectedFarmer() !== undefined) {
			let apiComptaibleProductionTypes: ApiCompatibleProductionType[] = [];
			for (let productionType of this.selectedFarmer()!.productionType) {
				apiComptaibleProductionTypes = apiComptaibleProductionTypes.concat(QsFarmerProductionCombination.splitProductionIdIntoAPICompatibleIDs(productionType));
			}
			return apiComptaibleProductionTypes;
		}
		return [];
	});
	selectedProductionUsageGroups: Signal<ProductionUsageGroup[]> = computed(() => {
		let productionType = this.selectedProductionType();
		if (productionType) {
			return QsFarmerAnimalAgeUsageGroup.getUsageGroupsBasedOnProductionType(productionType.productionType);
		}
		return [];
	});
	selectedDrugPackingForms: Signal<DrugPackage[]> = computed(() => {
		let drug = this.selectedDrug();
		if (drug) {
			return drug.item.forms;
		}
		return [];
	});

	// Serializer
	farmerProductionTypeSerializer: IStringify<ApiCompatibleProductionType> = { display: (prodType) => ({ text: prodType.productionTypeName, hint: NO_HINT }) };
	usageGroupSerializer: IStringify<ProductionUsageGroup> = { display: (usageGroup) => ({ text: usageGroup.usageGroupName, hint: NO_HINT }) };
	drugPackingSerializer: IStringify<DrugPackage> = { display: (drugPackage) => ({ text: drugPackage.package, hint: NO_HINT }) };
	drugUnitSerializer: IStringify<DrugUnit> = { display: (drugUnit) => ({ text: drugUnit.name, hint: NO_HINT }) };
	drugSerializer: IStringify<CategorizedItem<ReportableDrug>> = {
		display: (reportableDrug) => ({
			text: reportableDrug.item.name + (reportableDrug.item.forms.length == 1 ? " - " + reportableDrug.item.forms[0].package : " ..."),
			hint: reportableDrug.category == DRUG_CATEGORY_OK ? HINT_OK : HINT_WARN
		})
	};


	// Validators
	biggerThanZeroValidator(control: AbstractControl): ValidationErrors | null {
		const forbidden = parseFloat(control.value) <= 0;
		return forbidden ? { notAllowed: { value: control.value } } : null;
	};

	private formBuilder = inject(FormBuilder);
	qsFormGroup = this.formBuilder.group({
		productionType: new FormControl<ApiCompatibleProductionType | null>(null, Validators.required),
		usageGroup: new FormControl<ProductionUsageGroup | null>(null, Validators.required),
		animalCount: [0, Validators.required],
		drugZNR: new FormControl<CategorizedItem<ReportableDrug> | null>(null, Validators.required),
		drugPID: new FormControl<DrugPackage | null>(null, Validators.required),
		amount: [0, [Validators.required, this.biggerThanZeroValidator]],
		amountUnit: new FormControl<DrugUnit | null>(null, Validators.required),
		applicationDuration: [0, Validators.required]
	});

	drugSelected(drug: CategorizedItem<ReportableDrug> | undefined) {
		if (drug?.category == DRUG_CATEGORY_WARN) {
			this.drugErrorOverlayShown.emit(drug.item);
		}
	}

	drugPackingFormSelected(drugPacking?: DrugPackage) {
		if (drugPacking) {
			if (drugPacking.unitSuggestion) {
				let unitQS = Object.values(DrugUnits).find(u => u.id == drugPacking.unitSuggestion.id && u.name == drugPacking.unitSuggestion.name);
				this.drugUnitDOM?.selectItemExt(unitQS);
			}
		} else {
			this.drugUnitDOM?.selectItemExt(undefined);
		}
	}

	resetForm(fullClear: boolean) {
		this.qsFormGroup.controls.amount.setValue(0);
		this.qsFormGroup.controls.amountUnit.setValue(null);
		this.qsFormGroup.controls.applicationDuration.setValue(0);
		this.qsFormGroup.controls.drugZNR.setValue(null);
		this.qsFormGroup.controls.drugPID.setValue(null);
		if (fullClear) {
			this.qsFormGroup.controls.productionType.setValue(null);
			this.qsFormGroup.controls.usageGroup.setValue(null);
			this.qsFormGroup.controls.animalCount.setValue(0);
		}
	}

	async deserializeObjectToForm(object: PrescriptionRow) {
		// Write new values to source signals() to kickstart computed() recalculation
		let productionType = QsFarmerAnimalAgeUsageGroup.getProductionTypeBasedOnUsageGroup(object.animalGroup);

		await computedIsUpdated(this.injector, this.selectedFarmerProductionTypes);
		this.qsFormGroup.controls["productionType"].setValue(this.selectedFarmerProductionTypes().find(pt => pt.productionType == productionType) || null);
		await computedIsUpdated(this.injector, this.selectedProductionUsageGroups);

		this.qsFormGroup.controls["usageGroup"].setValue(this.selectedProductionUsageGroups().find(ug => ug.usageGroup == object.animalGroup) || null);
		this.qsFormGroup.controls["animalCount"].setValue(object.animalCount);
		this.qsFormGroup.controls["amount"].setValue(object.drugs[0].amount);
		this.qsFormGroup.controls["applicationDuration"].setValue(object.drugs[0].applicationDuration);

		// We need to find the correct drug using znr and pid. We may have the same drug in our prefered drug list and the fallback list.
		// Find all drugs that have the correct znr and contain the correct pid, then use a drug from the prefered drug list if found, otherwise use the drug from the fallback drug list.
		let applicableDrugEntries = this.reportableDrugList.filter(d => d.item.znr == object.drugs[0].approvalNumber
			&& d.item.forms.map(f => f.pid).includes(object.drugs[0].packageId));
		// We filtered for all drugs with correct znr and pid. Now use the drug from the OK category if found, otherwise just use first drug found.
		let drug = applicableDrugEntries.find(d => d.category == DRUG_CATEGORY_OK) || applicableDrugEntries[0];
		let packaging = drug.item.forms.find(form => form.pid == object.drugs[0].packageId) || null;

		// Wait for computed() list selectedDrugPackingForms to be recalculated.
		this.qsFormGroup.controls["drugZNR"].setValue(drug);
		await computedIsUpdated(this.injector, this.selectedDrugPackingForms);
		this.qsFormGroup.controls["drugPID"].setValue(packaging);
		this.qsFormGroup.controls["amountUnit"].setValue(this.drugUnits.find(du => du.id == object.drugs[0].amountUnit) || null);

		this.qsFormGroup.updateValueAndValidity();
	}

	serializeFormToObject(): PrescriptionRow {
		return {
			// locationNumber: this.selectedFarmer()?.locationNumber!,
			animalCount: this.qsFormGroup.controls["animalCount"].value!,
			animalGroup: this.selectedUsageGroup()?.usageGroup!,
			drugs: [
				{
					amount: this.qsFormGroup.controls["amount"].value!,
					amountUnit: this.selectedDrugUnit()!.id,
					applicationDuration: this.qsFormGroup.controls["applicationDuration"].value!,
					approvalNumber: this.selectedDrug()!.item.znr,
					packageId: this.selectedPackingForm()!.pid
				}
			]
		};
	}

	addPrescriptionRow() {
		this.addRow.emit();
	}
	removePrescriptionRow() {
		this.deleteRow.emit();
	}


	/* =========== Value Validation =========== */
	private onChangeValidationCallback?: Function = undefined;

	writeValue(obj: any): void {

	}
	registerOnChange(fn: any): void {
		this.onChangeValidationCallback = fn;
	}
	registerOnTouched(fn: any): void { }

	get control(): FormControl {
		return this.controlDir.control as FormControl;
	}
}
