import { NgFor } from '@angular/common';
import { afterNextRender, Component, inject, Injector, runInInjectionContext, signal, ViewChild, WritableSignal } from '@angular/core';
import { FormArray, FormBuilder, FormControl, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { Subject } from 'rxjs';
import { ApiInterfacePatchBusinessIn, ApiInterfacePatchBusinessOut, ApiInterfacePatchCustomerIn, ApiInterfacePatchCustomerOut, ApiInterfacePatchDrugIn, ApiInterfacePatchDrugOut } from '../../../../../api_common/api_entities';
import { ApiModuleInterfaceB2F, ApiModuleInterfaceF2B } from '../../../../../api_common/backend_call';
import { Business, EMPTY_BUSINESS } from '../../../../../api_common/generic_types/business';
import { CombinedEntity } from '../../../../../api_common/generic_types/chunk';
import { Customer, EMPTY_CUSTOMER } from '../../../../../api_common/generic_types/customer';
import { Drug, DrugPackage, DrugVerifiedState, EMPTY_DRUG } from '../../../../../api_common/generic_types/drug';
import { DatepickerComponent } from '../datepicker/datepicker.component';
import { NO_HINT } from '../hint-ok/hint.component';
import { LoadingoverlayService } from '../loadingoverlay/loadingoverlay.service';
import { LoggedOutSvgComponent } from '../logged-out-svg/logged-out-svg.component';
import { ModuleComponent } from '../module/module/module.component';
import { EntitiesBackendFetch, EntitiesBackendService } from '../modules/entities/entities-backend.service';
import { IPlaceholderSerializer, PlaceholderFieldComponent } from '../placeholder-field/placeholder-field.component';
import { IStringify, SearchDropdownComponent } from '../search-dropdown/search-dropdown.component';
import { OfflineEntry } from '../shared-service/offline-sync/offline-entry';
import { OfflineModuleStore } from '../shared-service/offline-sync/offline-module-store';
import { OfflineStoreService } from '../shared-service/offline-sync/offline-store.service';
import { SessionType } from '../shared-service/session/session-provider.service';
import { ApplyEntryEvent, CommitSynchronizeEntryEvent, SyncOnlineControllerComponent } from '../sync-online-controller/sync-online-controller.component';
import { ErrorlistService } from '../timed-popups/popuplist/errorlist.service';

export enum EntityType {
	CUSTOMER,
	BUSINESS,
	DRUG,
}

@Component({
	selector: 'app-entities',
	imports: [ReactiveFormsModule, LoggedOutSvgComponent, SearchDropdownComponent, DatepickerComponent, SyncOnlineControllerComponent, PlaceholderFieldComponent, NgFor],
	templateUrl: './entities.component.html',
	styleUrl: './entities.component.scss'
})
export class EntitiesComponent extends ModuleComponent {

	static API_URL_PATCH_CUSTOMER = "/module/entities/patch-customer"
	static API_URL_PATCH_BUSINESS = "/module/entities/patch-business"
	static API_URL_PATCH_DRUG = "/module/entities/patch-drug"

	selectedEntityType = EntityType.CUSTOMER;

	customerList: WritableSignal<Customer[]> = signal([]);
	businessList: WritableSignal<Business[]> = signal([]);
	drugsList: WritableSignal<Drug[]> = signal([]);
	customerSerializer: IStringify<Customer> = { display: (customer) => ({ text: customer.search + " " + customer.firstName + " " + customer.givenName, hint: NO_HINT }) };

	businessSerializer: IStringify<Business> = {
		display: (business) => {
			const customer = this.customerList().find(c => c.commonId == business.customerMovetaId);
			return { text: (customer ? customer.search + " " + customer?.firstName + " " + customer?.givenName : "[?]") + " " + business.businessType + " " + business.vvvo, hint: NO_HINT }
		}
	};

	drugSerializer: IStringify<Drug> = { display: (drug) => ({ text: drug.name + " - " + drug.forms.map(form => form.package + " " + form.unitSuggestion?.name).join(", "), hint: NO_HINT }) };

	drugReportabilityItems: DrugVerifiedState[] = [DrugVerifiedState.eNOT_TESTED, DrugVerifiedState.eVERIFIED_NOT_REPORTABLE, DrugVerifiedState.eVERIFIED_SUCCESSFULLY_REPORTABLE]
	drugReportabilitySerial: IStringify<DrugVerifiedState> = {
		display: (state) => ({
			text: state == DrugVerifiedState.eNOT_TESTED ? "Unbekannt"
				: state == DrugVerifiedState.eVERIFIED_NOT_REPORTABLE ? "Nicht meldbar"
					: state == DrugVerifiedState.eVERIFIED_SUCCESSFULLY_REPORTABLE ? "Meldbar"
						: "Interner fehler", hint: NO_HINT
		})
	}
	drugFormSerializer: IPlaceholderSerializer<DrugPackage> = { serialize: (value) => value ? ("PID " + value.pid + ": " + value.package + (value.unitSuggestion ? " (QS: " + value.unitSuggestion.name + ")" : "")) : "" }

	pageInitFinished: Subject<void> = new Subject<void>();
	offlineModuleStore: OfflineModuleStore;
	currentSyncEntry: OfflineEntry | undefined = undefined;

	@ViewChild('syncController') syncController?: SyncOnlineControllerComponent;

	private formBuilder = inject(FormBuilder);
	customerFormGroup = this.formBuilder.group({
		// moveta read only data
		firstName: [{ value: "", disabled: true }],
		givenName: [{ value: "", disabled: true }],
		search: [{ value: "", disabled: true }],
		street: [{ value: "", disabled: true }],
		plz: [{ value: 0, disabled: true }],
		place: [{ value: "", disabled: true }],
		phone: [{ value: "", disabled: true }],
		memo: [{ value: "", disabled: true }],
		fax: [{ value: "", disabled: true }],
		email: [{ value: "", disabled: true }],
		birthday: [{ value: "", disabled: true }], // check if is correct date
		uid: [{ value: 0, disabled: true }],
		movetaCustomerId: [{ value: "", disabled: true }],

		// modifyable data
		image: [{ value: "", disabled: false }],
		nonpaying: [{ value: false, disabled: false }],
		altgpsstreet: [{ value: "", disabled: false }, Validators.required],
		altgpsplz: [{ value: "", disabled: false }, Validators.required],
		altgpsplace: [{ value: "", disabled: false }, Validators.required],

		customerDropdown: [{ value: EMPTY_CUSTOMER, disabled: false }]
	});

	businessFormGroup = this.formBuilder.group({
		customerMovetaId: [{ value: "", disabled: true }, Validators.required],
		businessType: [{ value: "", disabled: true }, Validators.required],
		vvvo: [{ value: "", disabled: true }, Validators.required],
		businessDropdown: [{ value: EMPTY_BUSINESS, disabled: false }],
		businessMovetaId: [{ value: "", disabled: true }],
	});

	drugFormGroup = this.formBuilder.group({
		znr: [{ value: "", disabled: true }],
		name: [{ value: "", disabled: true }],

		forms: this.formBuilder.array([new FormControl<DrugPackage>({} as DrugPackage, Validators.required)]),

		shortsearch: [{ value: "", disabled: true }, Validators.required],
		qsReportabilityState: new FormControl<DrugVerifiedState | null>(null, Validators.required),
		drugDropdown: [{ value: EMPTY_DRUG, disabled: false }],
		drugMovetaId: [{ value: "", disabled: true }],
	});

	businessSelected(business: Business | undefined) {
		if (business) {
			console.log("new business selected: ", business);
			runInInjectionContext(this.injector, () => afterNextRender(() => this.businessFormGroup.patchValue({
				businessType: business.businessType,
				customerMovetaId: business.customerMovetaId,
				vvvo: business.vvvo,
				businessMovetaId: business.commonId
			})));
		} else {
			Object.keys(this.businessFormGroup.controls).filter(c => c != 'businessDropdown').forEach(c => this.businessFormGroup.get(c)?.reset());
		}
	}

	drugSelected(drug: Drug | undefined) {
		if (drug) {
			console.log("new drug selected: ", drug);

			runInInjectionContext(this.injector, () => afterNextRender(() => this.drugFormGroup.patchValue({
				forms: [],
				name: drug.name,
				qsReportabilityState: drug.reportabilityVerifierMarkedErronous,
				shortsearch: drug.shortsearch,
				znr: drug.znr,
				drugMovetaId: drug.commonId
			})));
			this.drugForms.clear();
			drug.forms.forEach(f => this.drugForms.push(this.formBuilder.control(f)));
			console.log(this.drugFormGroup.value);
		} else {
			Object.keys(this.drugFormGroup.controls).filter(c => c != 'drugDropdown').forEach(c => this.drugFormGroup.get(c)?.reset());
		}
	}

	customerSelected(customer: Customer | undefined) {
		if (customer) {
			console.log("new customer selected: ", customer);
			runInInjectionContext(this.injector, () => afterNextRender(() => this.customerFormGroup.patchValue({
				firstName: customer.firstName,
				givenName: customer.givenName,
				search: customer.search,
				street: customer.street,
				plz: customer.plz,
				place: customer.place,
				phone: customer.phone || "",
				memo: customer.memo || "",
				fax: customer.fax || "",
				email: customer.email,
				birthday: customer.birthday ? DatepickerComponent.serializeDateGerman(customer.birthday) : "",
				uid: customer.uid,
				movetaCustomerId: customer.commonId,

				altgpsplace: customer.altgpsplace,
				altgpsplz: customer.altgpsplz,
				altgpsstreet: customer.altgpsstreet,
				nonpaying: customer.nonpaying,
				image: customer.image
			})));
			console.log(this.customerFormGroup.value);
		} else {
			Object.keys(this.customerFormGroup.controls).filter(c => c != 'customerDropdown').forEach(c => this.customerFormGroup.get(c)?.reset());
		}
	}

	override afterViewInit(): void {

	}

	constructor(private loadingService: LoadingoverlayService, private errorlistService: ErrorlistService, private offlineStore: OfflineStoreService, private injector: Injector) {
		super(EntitiesBackendService);
		Promise.allSettled([this.getBackendService().fetchBackendData()]).then((proms) => {
			let backendEntitiesProms = proms[0] as PromiseSettledResult<EntitiesBackendFetch>;

			if (backendEntitiesProms.status == 'fulfilled') {
				this.customerList.set(backendEntitiesProms.value.customers);
				this.businessList.set(backendEntitiesProms.value.businesses);
				this.drugsList.set(backendEntitiesProms.value.drugs);
				console.log("Loaded " + this.customerList().length + " customers, " + this.businessList().length + " betriebe, " + this.drugsList().length + " arzneien!");

				setTimeout(() => {
					this.pageInitFinished.next();
				}, 1);
			}
		});

		this.offlineModuleStore = this.offlineStore.getStore("entities")!;
		this.offlineModuleStore.recall();
	}

	selectCustomers() { this.selectedEntityType = EntityType.CUSTOMER }
	selectBusinesses() { this.selectedEntityType = EntityType.BUSINESS }
	selectDrugs() { this.selectedEntityType = EntityType.DRUG }
	isBusinessSelected() { return this.selectedEntityType == EntityType.BUSINESS }
	isCustomersSelected() { return this.selectedEntityType == EntityType.CUSTOMER }
	isDrugsSelected() { return this.selectedEntityType == EntityType.DRUG }

	extractCustomerFromForm(): Customer | undefined {
		this.customerFormGroup.updateValueAndValidity();
		if (this.customerFormGroup.value) {
			// We only populate those properties that are writable on the server, all others are ignored anyways.
			// We need to populate commonId=movetaCustomerId so the server can identify which entry to modify.
			let value = this.customerFormGroup.getRawValue();
			let customer: Customer = {
				// read only properties
				firstName: value.firstName!,
				givenName: value.givenName!,
				search: value.search!,
				street: value.street!,
				plz: value.plz!,
				place: value.place!,
				phone: value.phone!,
				memo: value.memo!,
				fax: value.fax!,
				email: value.email!,
				birthday: value.birthday ? new Date(value.birthday) : undefined,
				uid: value.uid!,
				// writable
				image: value.image || "",
				nonpaying: value.nonpaying || false,
				altgpsstreet: value.altgpsstreet || undefined,
				altgpsplz: value.altgpsplz || undefined,
				altgpsplace: value.altgpsplace || undefined,

				commonId: value.movetaCustomerId!,
			};
			return customer;
		}
		return undefined;
	}

	extractBusinessFromForm(): Business | undefined {
		this.businessFormGroup.updateValueAndValidity();
		if (this.businessFormGroup.value) {
			let value = this.businessFormGroup.getRawValue();
			let business: Business = {
				// readonly
				commonId: value.businessMovetaId!,
				businessType: value.businessType!,
				customerMovetaId: value.customerMovetaId!,
				vvvo: value.vvvo!,
				// writable
				dummy: ""
			};
			// update values here
			return business;
		}
		return undefined;
	}

	extractDrugFromForm(): Drug | undefined {
		this.drugFormGroup.updateValueAndValidity();
		if (this.drugFormGroup.value) {
			let value = this.drugFormGroup.getRawValue();
			let drug: Drug = {
				// read only
				name: value.name!,
				shortsearch: value.shortsearch!,
				znr: value.znr!,
				forms: value.forms.map(f => f!),
				commonId: value.drugMovetaId!,
				// writable
				reportabilityVerifierMarkedErronous: value.qsReportabilityState ?? DrugVerifiedState.eNOT_TESTED,
			};
			return drug;
		}
		return undefined;
	}

	resetForm() {
		if (this.isCustomersSelected()) this.customerSelected(undefined);
		if (this.isBusinessSelected()) this.businessSelected(undefined);
		if (this.isDrugsSelected()) this.drugSelected(undefined);
	}

	storeEntity<TRequest extends ApiModuleInterfaceF2B, TResponse extends ApiModuleInterfaceB2F, TEntity extends CombinedEntity>(url: string, formGroup: FormGroup, extractFunc: () => TEntity | undefined, buildRequest: (entity: TEntity) => TRequest): Promise<TResponse | undefined> {
		return new Promise<TResponse | undefined>((resFin, rejFin) => {
			let res = ((entityPatched: TResponse | undefined) => { this.loadingService.hideLoadingOverlay(); resFin(entityPatched) });
			let rej = (() => { this.loadingService.hideLoadingOverlay(); rejFin() });

			formGroup.updateValueAndValidity(); // Ensure the valid attribute is up-to-date.
			if (formGroup.valid) {
				let entity = extractFunc();
				if (entity != undefined) {
					this.loadingService.showLoadingOverlay();

					let putRequest = buildRequest(entity);
					if (this.getSessionService().getSessionType() == SessionType.ONLINE) {
						this.getBackendService().authorizedBackendCall<TRequest, TResponse>(url, putRequest).then(dat => {
							this.errorlistService.showErrorMessage("Entität erfolgreich gespeichert!");
							if (this.syncController?.isSyncMode() && this.currentSyncEntry) {
								this.resetForm();
								this.syncController.deleteEntry(this.currentSyncEntry);

								this.businessFormGroup.controls.businessDropdown.enable();
								this.customerFormGroup.controls.customerDropdown.enable();
								this.drugFormGroup.controls.drugDropdown.enable();
							}
							res(dat);
						}).catch(_ => {
							rej();
						});
					}
					else if (this.getSessionService().getSessionType() == SessionType.OFFLINE) {
						let offlineEntry = new OfflineEntry({
							endpoint: url,
							item: putRequest
						});
						this.offlineModuleStore.appendEntry(offlineEntry);
						this.errorlistService.showErrorMessage("Element als Offline-Synchronisierungseintrag gespeichert!");
						this.resetForm();
						res(undefined);
					}
				}
			} else {
				this.errorlistService.showErrorMessage("Formular ist nicht vollständig gültig ausgefüllt!");
				rej();
			}
		});
	}

	storeCustomer(): Promise<void> {
		console.log(this.customerFormGroup.value, Object.entries(this.customerFormGroup.controls).map(k => k[0] + " " + k[1].value + " valid: " + k[1].valid), this.customerFormGroup.valid);

		return this.storeEntity<ApiInterfacePatchCustomerIn, ApiInterfacePatchCustomerOut, Customer>(EntitiesComponent.API_URL_PATCH_CUSTOMER, this.customerFormGroup, this.extractCustomerFromForm.bind(this), (entity) => {
			return {
				cacheTillOnline: false,
				customer: entity
			};
		}).then((readback: ApiInterfacePatchCustomerOut | undefined) => {
			if (readback !== undefined) {
				let localCustomer = this.customerList().find(cust => cust.commonId == readback.customerReadback.commonId);
				if (localCustomer !== undefined) {
					Object.assign(localCustomer, readback.customerReadback);
				}
			}
		});
	}

	storeBusiness(): Promise<void> {
		console.log(this.businessFormGroup.value);
		return this.storeEntity<ApiInterfacePatchBusinessIn, ApiInterfacePatchBusinessOut, Business>(EntitiesComponent.API_URL_PATCH_BUSINESS, this.businessFormGroup, this.extractBusinessFromForm.bind(this), (entity) => {
			return {
				cacheTillOnline: false,
				business: entity
			}
		}).then((readback: ApiInterfacePatchBusinessOut | undefined) => {
			if (readback !== undefined) {
				let localBusiness = this.businessList().find(business => business.commonId == readback.businessReadback.commonId);
				if (localBusiness !== undefined) {
					Object.assign(localBusiness, readback.businessReadback);
				}
			}
		});
	}

	storeDrug(): Promise<void> {
		console.log(this.drugFormGroup.value);
		return this.storeEntity<ApiInterfacePatchDrugIn, ApiInterfacePatchDrugOut, Drug>(EntitiesComponent.API_URL_PATCH_DRUG, this.drugFormGroup, this.extractDrugFromForm.bind(this), (entity) => {
			return {
				cacheTillOnline: false,
				drug: entity
			}
		}).then((readback: ApiInterfacePatchDrugOut | undefined) => {
			if (readback !== undefined) {
				let localDrug = this.drugsList().find(drug => drug.commonId == readback.drugReadback.commonId);
				if (localDrug !== undefined) {
					Object.assign(localDrug, readback.drugReadback);
				}
			}
		});;
	}

	restoreCustomer(customer: Customer) {
		console.log(this.customerFormGroup.value);
		customer.birthday = customer.birthday ? new Date(customer.birthday) : undefined;
		return customer;
	}

	applyOfflineEntry(offlineEntry: ApplyEntryEvent) {
		if (offlineEntry) {
			offlineEntry.applyFinished = new Promise(async (res, _) => {
				let entityTypeEndpoint = offlineEntry.entry.item["endpoint"];
				runInInjectionContext(this.injector, () => {
					switch (entityTypeEndpoint) {
						case EntitiesComponent.API_URL_PATCH_BUSINESS:
							this.selectBusinesses();
							afterNextRender(async () => {
								await this.businessSelected(offlineEntry.entry.item["item"]["business"]);
								this.businessFormGroup.controls.businessDropdown.disable();
								this.currentSyncEntry = offlineEntry.entry;
								res();
							});
							break;
						case EntitiesComponent.API_URL_PATCH_CUSTOMER:
							this.selectCustomers();
							afterNextRender(async () => {
								await this.customerSelected(this.restoreCustomer(offlineEntry.entry.item["item"]["customer"]));
								this.customerFormGroup.controls.customerDropdown.disable();
								this.currentSyncEntry = offlineEntry.entry;
								res();
							});
							break;
						case EntitiesComponent.API_URL_PATCH_DRUG:
							this.selectDrugs();
							afterNextRender(async () => {
								await this.drugSelected(offlineEntry.entry.item["item"]["drug"]);
								this.drugFormGroup.controls.drugDropdown.disable();
								this.currentSyncEntry = offlineEntry.entry;
								res();
							});
							break;
					}

				});
			});
		}
	}

	unloadOfflineEntry() {
		this.resetForm();

		if (this.currentSyncEntry) {
			let entityTypeEndpoint = this.currentSyncEntry?.item["endpoint"];
			switch (entityTypeEndpoint) {
				case EntitiesComponent.API_URL_PATCH_BUSINESS:
					this.businessFormGroup.controls.businessDropdown.enable();
					break;
				case EntitiesComponent.API_URL_PATCH_CUSTOMER:
					this.customerFormGroup.controls.customerDropdown.enable();
					break;
				case EntitiesComponent.API_URL_PATCH_DRUG:
					this.drugFormGroup.controls.drugDropdown.enable();
					break;
			}
		}

		this.currentSyncEntry = undefined;
	}

	commitSynchronizeEntry(entry: CommitSynchronizeEntryEvent) {
		if (this.currentSyncEntry != entry.entry) {
			this.errorlistService.showErrorMessage("Error in apply-commit-unload sequence! Commit entry does not match apply entry.");
		} else {
			let entityTypeEndpoint = entry.entry.item["endpoint"];
			switch (entityTypeEndpoint) {
				case EntitiesComponent.API_URL_PATCH_BUSINESS:
					entry.synchronizationSuccess = this.storeBusiness();
					break;
				case EntitiesComponent.API_URL_PATCH_CUSTOMER:
					entry.synchronizationSuccess = this.storeCustomer();
					break;
				case EntitiesComponent.API_URL_PATCH_DRUG:
					entry.synchronizationSuccess = this.storeDrug();
					break;
			}
		}
	}

	get drugForms() {
		return this.drugFormGroup.get('forms') as FormArray;
	}
}
