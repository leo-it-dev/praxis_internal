import { NgFor } from '@angular/common';
import { AfterViewInit, ChangeDetectorRef, Component, inject, QueryList, Signal, signal, ViewChild, ViewChildren, WritableSignal } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { FormArray, FormBuilder, FormControl, ReactiveFormsModule, Validators } from '@angular/forms';
import { Subject } from 'rxjs';
import { ApiInterfacePutPrescriptionRowsIn, Farmer, PrescriptionRow, ReportableDrug } from "../../../../../api_common/api_qs";
import { ApiInterfaceEmptyOut } from '../../../../../api_common/backend_call';
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
import { QsreportBackendService } from './qsreport-backend.service';

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

	static API_URL_POST_REPORT = "/module/qs/report"

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

	_sessionService: SessionProviderService;

	ngAfterViewInit(): void {
		this.loadUiFinishedCallback();
	}

	async loadApiData() {
		if (this.sessionService.store.qsVeterinaryName) {
			let control = this.qsFormGroup.controls["vetName"];
			control.setValue(this.sessionService.store.qsVeterinaryName || "<unknown>");
			control.disable();
		}

		Promise.allSettled([this.qsreportBackend.fetchBackendData(), this.loadUiFinished]).then((proms) => {
			let backendFetchProm = proms[0];
			if (backendFetchProm.status == 'fulfilled') {
				this.reportableDrugList.set(backendFetchProm.value.drugs);
				console.log("Loaded " + this.reportableDrugList().length + " drugs!");
				this.farmers.set(backendFetchProm.value.farmers);
				console.log("Loaded " + this.farmers().length + " farmers!");
			}

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
		private changeDetectorRef: ChangeDetectorRef,
		private qsreportBackend: QsreportBackendService
	) {
		this._sessionService = sessionService;
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
		this.prescriptionRows.insert(i+1, this.formBuilder.control('', Validators.required));
	}

	removePrescriptionRow(i: number) {
		if(this.prescriptionRows.length > 1) {
			this.prescriptionRows.removeAt(i);
		}
	}

	resetForm(fullClear: boolean) {
		if (fullClear) {
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
		let userShort = this.sessionService.store.lazyloadUserInfo?.accName.toUpperCase().substring(0, 3) || "<unknown>";
		let documentNumber = userShort + parseInt(String(new Date().getTime()));

		return {
			cacheTillOnline: true,
			drugReport: {
				veterinary: this.qsFormGroup.controls["vetName"].value!,
				deliveryDate: this.toDateString(DatepickerComponent.parseDateGerman(this.qsFormGroup.controls["deliveryDate"].value!)!),
				documentNumber: documentNumber,
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
