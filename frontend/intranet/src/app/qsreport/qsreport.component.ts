import { NgFor } from '@angular/common';
import { AfterViewInit, ChangeDetectorRef, Component, inject, QueryList, Signal, signal, ViewChild, ViewChildren, WritableSignal } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { FormArray, FormBuilder, FormControl, ReactiveFormsModule, Validators } from '@angular/forms';
import { Subject } from 'rxjs';
import { ApiInterfaceDrugsOut, ApiInterfaceFarmersOut, ApiInterfacePutPrescriptionRowsIn, Farmer, PrescriptionRow, ReportableDrug } from "../../../../../api_common/api_qs";
import { ApiInterfaceEmptyIn, ApiInterfaceEmptyOut } from '../../../../../api_common/backend_call';
import { BackendService } from '../api/backend.service';
import { BlockingoverlayComponent, OverlayButtonDesign } from '../blockingoverlay/blockingoverlay.component';
import { DatepickerComponent } from '../datepicker/datepicker.component';
import { ErrorlistService } from '../errorlist/errorlist.service';
import { HintComponent } from "../hint-ok/hint.component";
import { Hint, IStringify, NO_HINT, SearchDropdownComponent } from '../search-dropdown/search-dropdown.component';
import { OfflineEntry } from '../shared-service/offline-sync/offline-entry';
import { OfflineModuleStore } from '../shared-service/offline-sync/offline-module-store';
import { OfflineStoreService } from '../shared-service/offline-sync/offline-store.service';
import { SessionProviderService, SessionType } from '../shared-service/session/session-provider.service';
import { ApplyEntryEvent, CommitSynchronizeEntryEvent, SyncOnlineControllerComponent } from "../sync-online-controller/sync-online-controller.component";
import { CategorizedList } from '../utilities/categorized-list';
import { PrescriptionRowComponent } from "./prescription-row/prescription-row.component";

export const DRUG_CATEGORY_OK = "moveta";
export const DRUG_CATEGORY_WARN = "hit";

export const HINT_OK: Hint = { color: 'var(--notification)', text: 'OK' }
export const HINT_WARN: Hint = { color: 'orange', text: 'WARN' }

@Component({
	selector: 'app-qsreport',
	imports: [DatepickerComponent, BlockingoverlayComponent, ReactiveFormsModule, SyncOnlineControllerComponent, HintComponent, NgFor, PrescriptionRowComponent, SearchDropdownComponent],
	templateUrl: './qsreport.component.html',
	styleUrl: './qsreport.component.scss'
})
export class QsreportComponent implements AfterViewInit {

	@ViewChildren(PrescriptionRowComponent) prescriptionRowsDOM!: QueryList<PrescriptionRowComponent>;

	selectedFarmer: Signal<Farmer | undefined | null>;
	farmerSerializer: IStringify<Farmer> = { display: (farmer) => ({ text: farmer.name.replaceAll("  ", " "), hint: NO_HINT }) };

	pageInitFinished: Subject<void> = new Subject<void>();

	static API_URL_DRUG = "https://internal.mittermeier-kraiburg.vet/module/qs/drugs"
	static API_URL_FARMER = "https://internal.mittermeier-kraiburg.vet/module/qs/farmers"
	static API_URL_POST_REPORT = "https://internal.mittermeier-kraiburg.vet/module/qs/report"

	HINT_OK_local = HINT_OK;
	HINT_WARN_local = HINT_WARN;

	offlineModuleStore: OfflineModuleStore;
	currentSyncEntry: OfflineEntry | undefined = undefined;

	loadUiFinishedCallback: Function = ()=>{};
	loadUiFinished = new Promise((res, _) => this.loadUiFinishedCallback = res);

	@ViewChild('syncController') syncController?: SyncOnlineControllerComponent;

	drugErrorOverlayShown: WritableSignal<boolean> = signal(false);
	drugErrorOverlayDrugName: string = "<unset>";
	drugErrorOverlayQuitRemembered: boolean = false;
	
	readonly OverlayButtonDesign: typeof OverlayButtonDesign = OverlayButtonDesign;
	drugErrorOverlayButtons = [{
		text: "OK",
		id: 1,
		design: OverlayButtonDesign.PRIMARY_COLORED
	}];

	reportableDrugList: WritableSignal<CategorizedList<ReportableDrug>> = signal(new CategorizedList<ReportableDrug>());
	farmers: WritableSignal<Farmer[]> = signal([]);

	ngAfterViewInit(): void {
		this.loadUiFinishedCallback();
	}

	async loadApiData() {
		let loadDrugs = this.backendService.authorizedBackendCall<ApiInterfaceEmptyIn, ApiInterfaceDrugsOut>(QsreportComponent.API_URL_DRUG).then(dat => {
				const categorized = new CategorizedList<ReportableDrug>();
				categorized.init({ category: DRUG_CATEGORY_OK, items: dat.prefered },
					{ category: DRUG_CATEGORY_WARN, items: dat.fallback });
				this.reportableDrugList.set(categorized);
				console.log("Loaded " + this.reportableDrugList().length + " drugs!");
			}).catch(e => {
				this.errorlistService.showErrorMessage("Error receiving list of reportable drugs: " + e);
			});

		let loadFarmers = this.backendService.authorizedBackendCall<ApiInterfaceEmptyIn, ApiInterfaceFarmersOut>(QsreportComponent.API_URL_FARMER).then(dat => {
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

		Promise.allSettled([loadDrugs, loadFarmers, this.loadUiFinished]).then(() => {
			setTimeout(() => {
				this.pageInitFinished.next();
			}, 1);
		});
	}

	buildPatternThisAndPreviousYear() {
		let thisYear = new Date().getFullYear();
		let lastYear = thisYear - 1;
		return '^[0-3][0-9]\.[0-1][0-9]\.((' + thisYear + ')|(' + lastYear + '))$';
	}

	private formBuilder = inject(FormBuilder);
	qsFormGroup = this.formBuilder.group({
		vetName: ['', Validators.required],
		documentNumber: ['', Validators.required],
		deliveryDate: ['', [Validators.required, Validators.pattern(this.buildPatternThisAndPreviousYear())]],
		locationNumber: new FormControl<Farmer|null>(null),
		prescriptionRows: this.formBuilder.array([new FormControl<PrescriptionRow>({} as PrescriptionRow, Validators.required)])
	});

	get prescriptionRows() {
		return this.qsFormGroup.get('prescriptionRows') as FormArray;
	}

	constructor(
		private errorlistService: ErrorlistService,
		private backendService: BackendService,
		private sessionService: SessionProviderService,
		private offlineStore: OfflineStoreService,
		private changeDetectorRef: ChangeDetectorRef
	) {
		this.loadApiData();
		this.offlineModuleStore = this.offlineStore.getStore("qs")!;
		this.offlineModuleStore.recall();

		if (!sessionService.store.isLoggedIn) {
			sessionService.redirectClientToLoginPage("This service requires you to be logged in!");
		}

		this.selectedFarmer = toSignal(this.qsFormGroup.controls["locationNumber"].valueChanges)
	}

	toDateString(date: Date) {
		return date.getFullYear() + "-" + String(date.getMonth() + 1).padStart(2, '0') + "-" + String(date.getDate()).padStart(2, '0');
	}

	fromDateString(date: string) {
		return new Date(
			parseInt(date.split("-")[0]),
			parseInt(date.split("-")[1]) - 1,
			parseInt(date.split("-")[2])
		);
	}

	addPrescriptionRow(i: number) {
		// this.prescriptionRows.update((els) => [...els, { id: this.prescriptionRows.length + 1 }])
		this.prescriptionRows.insert(i+1, this.formBuilder.control('', Validators.required));
	}
	removePrescriptionRow(i: number) {
		if(this.prescriptionRows.length > 1) {
			this.prescriptionRows.removeAt(i);
		}
		// this.prescriptionRows.update((els) => els.filter((e) => e != els[els.length - 1] || els.length == 1))
	}

	resetForm(fullClear: boolean) {
		if (fullClear) {
			this.qsFormGroup.controls.documentNumber.setValue("");
			this.qsFormGroup.controls.deliveryDate.setValue(DatepickerComponent.serializeDateGerman(new Date()));
		}
		this.prescriptionRowsDOM.forEach(e => {
			e.resetForm(fullClear);
		});
		while(this.prescriptionRows.length > 1) {
			this.removePrescriptionRow(this.prescriptionRows.length - 1);
		}
	}

	async deserializeObjectToForm(object: ApiInterfacePutPrescriptionRowsIn) {
		// Vet name is just a placeholder in the stored object. We need to ensure, noone can just store QS entries for another vet. Therefore we set it here to the current sessions vet name!
		this.qsFormGroup.controls["vetName"].setValue(this.sessionService.store.qsVeterinaryName || "<unknown>");
		this.qsFormGroup.controls["deliveryDate"].setValue(DatepickerComponent.serializeDateGerman(this.fromDateString(object.drugReport.deliveryDate)));
		this.qsFormGroup.controls["documentNumber"].setValue(String(object.drugReport.documentNumber));
		this.qsFormGroup.controls["locationNumber"].setValue(this.farmers().find(f => f.locationNumber == object.drugReport.locationNumber)!);

		while(this.prescriptionRows.length > object.drugReport.prescriptionRows.length) {
			this.removePrescriptionRow(this.prescriptionRows.length - 1);
		}
		while(this.prescriptionRows.length < object.drugReport.prescriptionRows.length) {
			this.addPrescriptionRow(this.prescriptionRows.length - 1);
		}

		this.changeDetectorRef.detectChanges(); // Force ViewChildren list prescriptionRowsDOM to be updated

		let i = 0;
		for(let prescRow of object.drugReport.prescriptionRows) {
			let el = this.prescriptionRowsDOM.get(i);
			if (el == undefined) {
				console.error("Error fix this!");
			} else {
				await el.deserializeObjectToForm(prescRow);
			}
			i++;
		}
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

	serializeFormToObject(): ApiInterfacePutPrescriptionRowsIn {
		return {
			cacheTillOnline: true,
			drugReport: {
				veterinary: this.qsFormGroup.controls["vetName"].value!,
				deliveryDate: this.toDateString(DatepickerComponent.parseDateGerman(this.qsFormGroup.controls["deliveryDate"].value!)!),
				documentNumber: parseInt(this.qsFormGroup.controls["documentNumber"].value!),
				locationNumber: this.selectedFarmer()!.locationNumber,
				prescriptionRows: this.prescriptionRows.value
			}
		};
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
					}).catch(_ => {
						rej();
					});
				}
				else if (this.sessionService.getSessionType() == SessionType.OFFLINE) {
					let offlineEntry = new OfflineEntry(putRequest);
					this.offlineModuleStore.appendEntry(offlineEntry);
					this.errorlistService.showErrorMessage("Element als Offline-Synchronisierungseintrag gespeichert!");
					this.resetForm(false);
					res();
				}
			} else {
				this.errorlistService.showErrorMessage("Formular ist nicht vollständig gültig ausgefüllt!");
				console.log(this.qsFormGroup.value);
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

	showDrugErrorOverlay(drug: ReportableDrug|undefined) {
		if (drug && !this.drugErrorOverlayQuitRemembered) {
			this.drugErrorOverlayDrugName = drug.name;
			this.drugErrorOverlayShown.set(true);
			this.drugErrorOverlayQuitRemembered = true;
		} else {
			this.drugErrorOverlayShown.set(false);
		}
	}
}
