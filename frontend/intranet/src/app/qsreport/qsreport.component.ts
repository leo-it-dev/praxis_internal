import { Component, computed, effect, inject, Injector, resolveForwardRef, runInInjectionContext, signal, Signal, ViewChild, WritableSignal } from '@angular/core';
import { AbstractControl, FormBuilder, ReactiveFormsModule, ValidationErrors, Validators } from '@angular/forms';
import { ApiInterfaceDrugsOut, ApiInterfaceFarmersOut, ApiInterfacePutPrescriptionRowsIn, DrugPackage, DrugUnit, DrugUnits, Farmer, ReportableDrug } from "../../../../../api_common/api_qs";
import { ApiInterfaceEmptyIn, ApiInterfaceEmptyOut } from '../../../../../api_common/backend_call';
import { BackendService } from '../api/backend.service';
import { BlockingoverlayComponent, OverlayButtonDesign } from '../blockingoverlay/blockingoverlay.component';
import { DatepickerComponent } from '../datepicker/datepicker.component';
import { ErrorlistService } from '../errorlist/errorlist.service';
import { Hint, IStringify, NO_HINT, SearchDropdownComponent } from '../search-dropdown/search-dropdown.component';
import { SessionProviderService, SessionType } from '../shared-service/session/session-provider.service';
import { CategorizedItem, CategorizedList } from '../utilities/categorized-list';
import { ProductionUsageGroup, QsFarmerAnimalAgeUsageGroup } from './qs-farmer-production-age-mapping';
import { ApiCompatibleProductionType, QsFarmerProductionCombination } from './qs-farmer-production-combinations';
import { ApplyEntryEvent, CommitSynchronizeEntryEvent, SyncOnlineControllerComponent } from "../sync-online-controller/sync-online-controller.component";
import { OfflineStoreService } from '../shared-service/offline-sync/offline-store.service';
import { OfflineModuleStore } from '../shared-service/offline-sync/offline-module-store';
import { OfflineEntry } from '../shared-service/offline-sync/offline-entry';
import { Router } from '@angular/router';
import { HintComponent } from "../hint-ok/hint.component";

@Component({
	selector: 'app-qsreport',
	imports: [SearchDropdownComponent, DatepickerComponent, BlockingoverlayComponent, ReactiveFormsModule, SyncOnlineControllerComponent, HintComponent],
	templateUrl: './qsreport.component.html',
	styleUrl: './qsreport.component.scss'
})
export class QsreportComponent {

	static API_URL_DRUG = "https://internal.mittermeier-kraiburg.vet/module/qs/drugs"
	static API_URL_FARMER = "https://internal.mittermeier-kraiburg.vet/module/qs/farmers"
	static API_URL_POST_REPORT = "https://internal.mittermeier-kraiburg.vet/module/qs/report"

	offlineModuleStore: OfflineModuleStore;
	currentSyncEntry: OfflineEntry|undefined = undefined;

	DRUG_CATEGORY_OK = "moveta";
	DRUG_CATEGORY_WARN = "hit";

	HINT_OK: Hint = { color: 'lightgreen', text: 'OK' }
	HINT_WARN: Hint = { color: 'orange', text: 'WARN' }

	@ViewChild('drugUnitDOM') drugUnitDOM?: SearchDropdownComponent<DrugUnit>;
	@ViewChild('farmerDropdown') farmerDropdown?: SearchDropdownComponent<Farmer>;
	@ViewChild('productionDropdown') productionDropdown?: SearchDropdownComponent<ApiCompatibleProductionType>;
	@ViewChild('usageDropdown') usageDropdown?: SearchDropdownComponent<ProductionUsageGroup>;
	@ViewChild('drugDropdown') drugDropdown?: SearchDropdownComponent<ReportableDrug>;
	@ViewChild('packingDropdown') packingDropdown?: SearchDropdownComponent<DrugPackage>;
	@ViewChild('syncController') syncController?: SyncOnlineControllerComponent;

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

	drugUnits: Signal<DrugUnit[]> = signal(Object.values(DrugUnits));
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

		if (this.sessionService.store.qsVeterinaryName) {
			let control = this.qsFormGroup.controls["vetName"];
			control.setValue(this.sessionService.store.qsVeterinaryName || "<unknown>");
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
		private sessionService: SessionProviderService,
		private offlineStore: OfflineStoreService,
		private injector: Injector,
		private router: Router
	) {
		this.loadApiData();
		this.offlineModuleStore = this.offlineStore.getStore("qs")!;
		this.offlineModuleStore.recall();

		if(!sessionService.store.isLoggedIn) {
			sessionService.redirectClientToLoginPage("This service requires you to be logged in!");
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
				let unitQS = Object.values(DrugUnits).find(u => u.id == drugPacking.unitSuggestion.id && u.name == drugPacking.unitSuggestion.name);
				this.drugUnitDOM?.selectItemExt(unitQS);
			}
		} else {
			this.drugUnitDOM?.selectItemExt(undefined);
			console.log("Drug packing type unselected!");
		}
		this.selectedPackingForm.set(drugPacking);
	}

	toDateString(date: Date) {
		return date.getFullYear() + "-" + String(date.getMonth()+1).padStart(2, '0') + "-" + String(date.getDate()).padStart(2, '0');
	}


	fromDateString(date: string) {
		return new Date(
			parseInt(date.split("-")[0]),
			parseInt(date.split("-")[1])-1,
			parseInt(date.split("-")[2])
		);
	}

	resetForm(fullClear: boolean) {
		this.qsFormGroup.controls.amount.setValue(0);
		this.qsFormGroup.controls.amountUnit.setValue("");
		this.qsFormGroup.controls.applicationDuration.setValue(0);
		this.qsFormGroup.controls.drugZNR.setValue("");
		this.qsFormGroup.controls.drugPID.setValue("");
		if (fullClear) {
			this.qsFormGroup.controls.documentNumber.setValue("");
			this.qsFormGroup.controls.deliveryDate.setValue(DatepickerComponent.serializeDateGerman(new Date()));
			this.qsFormGroup.controls.locationNumber.setValue("");
			this.qsFormGroup.controls.productionType.setValue("");
			this.qsFormGroup.controls.usageGroup.setValue("");
			this.qsFormGroup.controls.animalCount.setValue(0);
		}
	}

	serializeFormToObject(): ApiInterfacePutPrescriptionRowsIn {
		return {
			cacheTillOnline: true,
			drugReport: {
				veterinary: this.qsFormGroup.controls["vetName"].value!,
				deliveryDate: this.toDateString(DatepickerComponent.parseDateGerman(this.qsFormGroup.controls["deliveryDate"].value!)!),
				documentNumber: parseInt(this.qsFormGroup.controls["documentNumber"].value!),
				locationNumber: this.selectedFarmer()?.locationNumber!,
				prescriptionRows: [
					{
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
					}
				]
			}
		};
	}

	async computedIsUpdated<T>(computedSignal: Signal<T>) {
		// Base problem: We need to wait for our computed() elements to be recomputed. These computed elements are based on the above selectedFarmer, etc.
		// Only real way to know of the recomputation is a side-effect (effect()). The effect can only run in an injection context. Also the effect must only contain
		// one signal so it only reacts to that signal being updated. To acchieve this we wrap the effect in a promise and only call the last computed() one time.
		// We finally wait for that promise to resolve and we are able to wait for the computed value to be updated :)
		return new Promise((resolve) => {
			runInInjectionContext(this.injector, () => {
				let eff = effect(() => {
					computedSignal(); // This is the last value we expect to be updated. So let's wait for that to be updated.
					resolve(null); // Update finished, resolve promise
					eff.destroy(); // Delete effect so it only fires once.
				});
			});
		});
	}

	async deserializeObjectToForm(object: ApiInterfacePutPrescriptionRowsIn) {
		// Vet name is just a placeholder in the stored object. We need to ensure, noone can just store QS entries for another vet. Therefore we set it here to the current sessions vet name!
		this.qsFormGroup.controls["vetName"].setValue(this.sessionService.store.qsVeterinaryName || "<unknown>");
		this.qsFormGroup.controls["deliveryDate"].setValue(DatepickerComponent.serializeDateGerman(this.fromDateString(object.drugReport.deliveryDate)));
		this.qsFormGroup.controls["documentNumber"].setValue(String(object.drugReport.documentNumber));

		// Write new values to source signals() to kickstart computed() recalculation
		let productionType = QsFarmerAnimalAgeUsageGroup.getProductionTypeBasedOnUsageGroup(object.drugReport.prescriptionRows[0].animalGroup);
		this.selectedFarmer.set(this.farmers().find(f => f.locationNumber == object.drugReport.locationNumber));
		// Wait for the last computed signal to be recomputed (selectedProductionUsageGroup)
		await this.computedIsUpdated(this.selectedFarmerProductionTypes);
		this.selectedProductionType.set(this.selectedFarmerProductionTypes().find(pt => pt.productionType == productionType));
		await this.computedIsUpdated(this.selectedProductionUsageGroups);
		this.selectedUsageGroup.set(this.selectedProductionUsageGroups().find(ug => ug.usageGroup == object.drugReport.prescriptionRows[0].animalGroup));
		
		// Once we write new values to the dropdowns they emit a event, which clears the content of dropdowns related to them.
		// Sadly this happens async, so the following setValue() calls will be overwritten with an empty string.
		// In order to prevent this, we call preventNextSelectEventEmit() which will temporarily disable the select event the next time a setValue is called (or other value update happens).
		this.farmerDropdown?.preventNextSelectEventEmit();
		this.productionDropdown?.preventNextSelectEventEmit();
		this.usageDropdown?.preventNextSelectEventEmit();
		this.drugDropdown?.preventNextSelectEventEmit();
		this.packingDropdown?.preventNextSelectEventEmit();

		this.qsFormGroup.controls["locationNumber"].setValue(this.farmerSerializer.display(this.selectedFarmer()!).text);
		this.qsFormGroup.controls["productionType"].setValue(this.farmerProductionTypeSerializer.display(this.selectedProductionType()!).text);
		this.qsFormGroup.controls["usageGroup"].setValue(this.usageGroupSerializer.display(this.selectedUsageGroup()!).text);
		this.qsFormGroup.controls["animalCount"].setValue(object.drugReport.prescriptionRows[0].animalCount);
		this.qsFormGroup.controls["amount"].setValue(object.drugReport.prescriptionRows[0].drugs[0].amount);
		this.qsFormGroup.controls["applicationDuration"].setValue(object.drugReport.prescriptionRows[0].drugs[0].applicationDuration);
	
		// We need to find the correct drug using znr and pid. We may have the same drug in our prefered drug list and the fallback list.
		// Find all drugs that have the correct znr and contain the correct pid, then use a drug from the prefered drug list if found, otherwise use the drug from the fallback drug list.
		let applicableDrugEntries = this.reportableDrugList().filter(d => d.item.znr == object.drugReport.prescriptionRows[0].drugs[0].approvalNumber
																		&& d.item.forms.map(f => f.pid).includes(object.drugReport.prescriptionRows[0].drugs[0].packageId));
		// We filtered for all drugs with correct znr and pid. Now use the drug from the OK category if found, otherwise just use first drug found.
		let drug = applicableDrugEntries.find(d => d.category == this.DRUG_CATEGORY_OK) || applicableDrugEntries[0];
		let packaging = drug.item.forms.find(form => form.pid == object.drugReport.prescriptionRows[0].drugs[0].packageId);
		this.selectedDrug.set(drug);
		this.selectedPackingForm.set(packaging);
		this.selectedDrugUnit.set(this.drugUnits().find(du => du.id == object.drugReport.prescriptionRows[0].drugs[0].amountUnit));
		
		// Wait for computed() list selectedDrugPackingForms to be recalculated.
		await this.computedIsUpdated(this.selectedDrugPackingForms);
		this.qsFormGroup.controls["drugZNR"].setValue(this.drugSerializer.display(drug).text);
		this.qsFormGroup.controls["drugPID"].setValue(this.drugPackingSerializer.display(packaging!).text);
		this.qsFormGroup.controls["amountUnit"].setValue(this.drugUnitSerializer.display(this.selectedDrugUnit()!).text);
	}

	applyOfflineEntry(offlineEntry: ApplyEntryEvent) {
		if (offlineEntry) {
			offlineEntry.applyFinished = new Promise(async (res, _) => {
				await this.deserializeObjectToForm(offlineEntry.entry.item);
				this.currentSyncEntry = offlineEntry.entry;
				res();
			});
		}
	}

	unloadOfflineEntry() {
		this.resetForm(true);
		this.currentSyncEntry = undefined;
	}

	submitForm(): Promise<void> {
		return new Promise((res, rej) => {
			this.qsFormGroup.updateValueAndValidity(); // Ensure the valid attribute is up-to-date.
			if (this.qsFormGroup.valid) {
				let putRequest = this.serializeFormToObject();
				if (this.sessionService.getSessionType() == SessionType.ONLINE) {
					this.backendService.authorizedBackendCall<ApiInterfacePutPrescriptionRowsIn, ApiInterfaceEmptyOut>(QsreportComponent.API_URL_POST_REPORT, putRequest
					).then(dat => {
						this.errorlistService.showErrorMessage("Abgabebeleg erfolgreich übermittelt!");
						if (this.syncController?.isSyncMode() && this.currentSyncEntry) {
							this.resetForm(true);
							this.syncController.deleteEntry(this.currentSyncEntry);
						} else {
							this.resetForm(false);
						}
						res();
					}).catch(e => {
						rej();
					});
				}
				else if(this.sessionService.getSessionType() == SessionType.OFFLINE) {
					let offlineEntry = new OfflineEntry(putRequest);
					this.offlineModuleStore.appendEntry(offlineEntry);
					this.errorlistService.showErrorMessage("Element als Offline-Synchronisierungseintrag gespeichert!");
					this.resetForm(false);
					res();
				}
			} else {
				rej();
			}
		});
	}

	commitSynchronizeEntry(entry: CommitSynchronizeEntryEvent) {
		if (this.currentSyncEntry != entry.entry) {
			this.errorlistService.showErrorMessage("Error in apply-commit-unload sequence! Commit entry does not match apply entry.");
		} else {
			entry.synchronizationSuccess = this.submitForm();
		}
	}

	isOnlineSession() {
		return this.sessionService.getSessionType() == SessionType.ONLINE;
	}
}
