import { afterNextRender, Component, computed, effect, ElementRef, inject, Injector, runInInjectionContext, Signal, signal, ViewChild, WritableSignal } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { FormBuilder, ReactiveFormsModule } from '@angular/forms';
import { Subject } from 'rxjs';
import { ApiInterfacePatchBusinessIn, ApiInterfacePatchBusinessOut, ApiInterfacePatchCustomerIn, ApiInterfacePatchCustomerOut, ApiInterfacePatchDrugIn, ApiInterfacePatchDrugOut, ApiInterfacePatchGenericOut } from '../../../../../api_common/api_entities';
import { ApiModuleInterfaceF2B } from '../../../../../api_common/backend_call';
import { Business, EMPTY_BUSINESS } from '../../../../../api_common/generic_types/business';
import { CombinedEntity } from '../../../../../api_common/generic_types/chunk';
import { Customer, EMPTY_CUSTOMER } from '../../../../../api_common/generic_types/customer';
import { Drug, EMPTY_DRUG } from '../../../../../api_common/generic_types/drug';
import { NO_HINT } from '../hint-ok/hint.component';
import { LoadingoverlayService } from '../loadingoverlay/loadingoverlay.service';
import { ModuleComponent } from '../module/module/module.component';
import { EntitiesBackendFetch, EntitiesBackendService } from '../modules/entities/entities-backend.service';
import { IStringify, SearchDropdownComponent } from '../search-dropdown/search-dropdown.component';
import { OfflineEntry } from '../shared-service/offline-sync/offline-entry';
import { OfflineModuleStore } from '../shared-service/offline-sync/offline-module-store';
import { OfflineStoreService } from '../shared-service/offline-sync/offline-store.service';
import { SessionType } from '../shared-service/session/session-provider.service';
import { ApplyEntryEvent, CommitSynchronizeEntryEvent, SyncOnlineControllerComponent } from '../sync-online-controller/sync-online-controller.component';
import { ErrorlistService } from '../timed-popups/popuplist/errorlist.service';
import { EntityBusinessComponent } from './entity-business/entity-business.component';
import { EntityCustomerComponent } from './entity-customer/entity-customer.component';
import { EntityDrugComponent } from './entity-drug/entity-drug.component';

export enum EntityType {
	CUSTOMER,
	BUSINESS,
	DRUG,
}

@Component({
	selector: 'app-entities',
	imports: [ReactiveFormsModule, SearchDropdownComponent, SyncOnlineControllerComponent, EntityCustomerComponent, EntityBusinessComponent, EntityDrugComponent],
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

	pageInitFinished: Subject<void> = new Subject<void>();
	offlineModuleStore: OfflineModuleStore;
	currentSyncEntry: OfflineEntry | undefined = undefined;

	@ViewChild('syncController') syncController?: SyncOnlineControllerComponent;
	@ViewChild('imageSelector') imageSelector?: ElementRef<HTMLInputElement>;

	private formBuilder = inject(FormBuilder);

	dropdownFormGroup = this.formBuilder.group({
		businessDropdown: [{ value: EMPTY_BUSINESS, disabled: false }],
		customerDropdown: [{ value: EMPTY_CUSTOMER, disabled: false }],
		drugDropdown: [{ value: EMPTY_DRUG, disabled: false }],

		customerEntity: EMPTY_CUSTOMER,
		businessEntity: EMPTY_BUSINESS,
		drugEntity: EMPTY_DRUG,

		mergeConflictCustomerServer: EMPTY_CUSTOMER,
		mergeConflictBusinessServer: EMPTY_BUSINESS,
		mergeConflictDrugServer: EMPTY_DRUG,
	});

	customerMergeConflict: Signal<Customer | null> = toSignal(this.dropdownFormGroup.controls.mergeConflictCustomerServer.valueChanges, { initialValue: EMPTY_CUSTOMER });
	businessMergeConflict: Signal<Business | null> = toSignal(this.dropdownFormGroup.controls.mergeConflictBusinessServer.valueChanges, { initialValue: EMPTY_BUSINESS });
	drugMergeConflict: Signal<Drug | null> = toSignal(this.dropdownFormGroup.controls.mergeConflictDrugServer.valueChanges, { initialValue: EMPTY_DRUG });
	customerLoaded: Signal<Customer | null> = toSignal(this.dropdownFormGroup.controls.customerEntity.valueChanges, { initialValue: EMPTY_CUSTOMER });
	businessLoaded: Signal<Business | null> = toSignal(this.dropdownFormGroup.controls.businessEntity.valueChanges, { initialValue: EMPTY_BUSINESS });
	drugLoaded: Signal<Drug | null> = toSignal(this.dropdownFormGroup.controls.drugEntity.valueChanges, { initialValue: EMPTY_DRUG });

	isMergeConflictBusinessGUIshown = computed(() => !!this.businessMergeConflict()?.commonId);
	isMergeConflictDrugGUIshown     = computed(() => !!this.drugMergeConflict()?.commonId);
	isMergeConflictCustomerGUIshown = computed(() => !!this.customerMergeConflict()?.commonId);

	isEditableBusinessGUIshown = computed(() => !!this.businessLoaded()?.commonId);
	isEditableDrugGUIshown     = computed(() => !!this.drugLoaded()?.commonId);
	isEditableCustomerGUIshown = computed(() => !!this.customerLoaded()?.commonId);

	selectCustomers() { this.selectedEntityType = EntityType.CUSTOMER }
	selectBusinesses() { this.selectedEntityType = EntityType.BUSINESS }
	selectDrugs() { this.selectedEntityType = EntityType.DRUG }
	isBusinessSelected() { return this.selectedEntityType == EntityType.BUSINESS }
	isCustomersSelected() { return this.selectedEntityType == EntityType.CUSTOMER }
	isDrugsSelected() { return this.selectedEntityType == EntityType.DRUG }

	customerSelected(customer: Customer | undefined) {
		if (customer != undefined) {
			this.dropdownFormGroup.controls.customerEntity.setValue(customer);
		} else {
			this.dropdownFormGroup.controls.customerEntity.reset();
		}
	}
	businessSelected(business: Business | undefined) {
		if (business != undefined) {
			this.dropdownFormGroup.controls.businessEntity.setValue(business);
		} else {
			this.dropdownFormGroup.controls.businessEntity.reset();
		}
	}
	drugSelected(drug: Drug | undefined) {
		if (drug != undefined) {
			this.dropdownFormGroup.controls.drugEntity.setValue(drug);
		} else {
			this.dropdownFormGroup.controls.drugEntity.reset();
		}
	}

	override afterViewInit(): void {}

	constructor(private loadingService: LoadingoverlayService, private errorlistService: ErrorlistService, private offlineStore: OfflineStoreService, private injector: Injector) {
		super(EntitiesBackendService);
		effect(() => {
			console.log(this.drugLoaded());
		})

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

	resetForm() {
		if (this.isCustomersSelected()) this.customerSelected(undefined);
		if (this.isBusinessSelected()) this.businessSelected(undefined);
		if (this.isDrugsSelected()) this.drugSelected(undefined);
	}

	storeEntity<TRequest extends ApiModuleInterfaceF2B, TResponse extends ApiInterfacePatchGenericOut, TEntity extends CombinedEntity>(url: string, checkValidity: () => boolean, extractFunc: () => TEntity | undefined, buildRequest: (entity: TEntity) => TRequest): Promise<TResponse | undefined> {
		return new Promise<TResponse | undefined>((resFin, rejFin) => {
			let res = ((entityPatched: TResponse | undefined) => { this.loadingService.hideLoadingOverlay(); resFin(entityPatched) });
			let rej = (() => { this.loadingService.hideLoadingOverlay(); rejFin() });

			if (checkValidity()) {
				let entity = extractFunc();
				if (entity != undefined) {
					this.loadingService.showLoadingOverlay();

					let putRequest = buildRequest(entity);
					if (this.getSessionService().getSessionType() == SessionType.ONLINE) {
						this.getBackendService().authorizedBackendCall<TRequest, TResponse>(url, putRequest).then(async dat => {
							if (!dat.mergeConflict) {
								this.errorlistService.showErrorMessage("Entität erfolgreich gespeichert!");
								if (this.syncController?.isSyncMode() && this.currentSyncEntry) {
									this.resetForm();
									await this.syncController.deleteEntry(this.currentSyncEntry);

									this.dropdownFormGroup.controls.businessDropdown.enable();
									this.dropdownFormGroup.controls.customerDropdown.enable();
									this.dropdownFormGroup.controls.drugDropdown.enable();
								}
							}
							res(dat);
						}).catch(err => {
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
		return new Promise((res, rej) => {
			this.storeEntity<ApiInterfacePatchCustomerIn, ApiInterfacePatchCustomerOut, Customer>(EntitiesComponent.API_URL_PATCH_CUSTOMER, () => {
				this.dropdownFormGroup.updateValueAndValidity();
				return this.dropdownFormGroup.controls.customerEntity.valid
			}, () => this.dropdownFormGroup.value.customerEntity!, (entity) => {
				return {
					cacheTillOnline: false,
					customer: entity,
					forcePush: this.isMergeConflictCustomerGUIshown()
				};
			}).then((readback: ApiInterfacePatchCustomerOut | undefined) => {
				if (readback !== undefined) {
					if (readback.mergeConflict) {
						this.dropdownFormGroup.controls.mergeConflictCustomerServer.setValue(readback.customerReadback);
						this.errorlistService.showErrorMessage("Mergekonflikt! Bitte Versionen vergleichen und dann absenden.");
						rej();
					} else {
						this.dropdownFormGroup.controls.mergeConflictCustomerServer.reset();
						let localCustomer = this.customerList().find(cust => cust.commonId == readback.customerReadback.commonId);
						if (localCustomer !== undefined) {
							Object.assign(localCustomer, readback.customerReadback);
						}
						res();
					}
				}
			});
		});
	}

	storeBusiness(): Promise<void> {
		return new Promise((res, rej) => {
			this.storeEntity<ApiInterfacePatchBusinessIn, ApiInterfacePatchBusinessOut, Business>(EntitiesComponent.API_URL_PATCH_BUSINESS, () => {
				this.dropdownFormGroup.updateValueAndValidity();
				return this.dropdownFormGroup.controls.businessEntity.valid
			}, () => this.dropdownFormGroup.value.businessEntity!, (entity) => {
				return {
					cacheTillOnline: false,
					business: entity,
					forcePush: this.isMergeConflictBusinessGUIshown()
				}
			}).then((readback: ApiInterfacePatchBusinessOut | undefined) => {
				if (readback !== undefined) {
					if (readback.mergeConflict) {
						this.dropdownFormGroup.controls.mergeConflictBusinessServer.setValue(readback.businessReadback);
						this.errorlistService.showErrorMessage("Mergekonflikt! Bitte Versionen vergleichen und dann absenden.");
						rej();
					} else {
						this.dropdownFormGroup.controls.mergeConflictBusinessServer.reset();
						let localBusiness = this.businessList().find(business => business.commonId == readback.businessReadback.commonId);
						if (localBusiness !== undefined) {
							Object.assign(localBusiness, readback.businessReadback);
						}
						res();
					}
				}
			});
		});
	}

	storeDrug(): Promise<void> {
		return new Promise((res, rej) => {
			this.storeEntity<ApiInterfacePatchDrugIn, ApiInterfacePatchDrugOut, Drug>(EntitiesComponent.API_URL_PATCH_DRUG, () => {
				this.dropdownFormGroup.updateValueAndValidity();
				return this.dropdownFormGroup.controls.drugEntity.valid
			}, () => this.dropdownFormGroup.value.drugEntity!, (entity) => {
				return {
					cacheTillOnline: false,
					drug: entity,
					forcePush: this.isMergeConflictDrugGUIshown()
				}
			}).then((readback: ApiInterfacePatchDrugOut | undefined) => {
				if (readback !== undefined) {
					if (readback.mergeConflict) {
						this.dropdownFormGroup.controls.mergeConflictDrugServer.setValue(readback.drugReadback);
						this.errorlistService.showErrorMessage("Mergekonflikt! Bitte Versionen vergleichen und dann absenden.");
						rej();
					} else {
						this.dropdownFormGroup.controls.mergeConflictDrugServer.reset();
						let localDrug = this.drugsList().find(drug => drug.commonId == readback.drugReadback.commonId);
						if (localDrug !== undefined) {
							Object.assign(localDrug, readback.drugReadback);
						}
						this.getBackendService().fetchBackendData();
						res();
					}
				}
			});
		});
	}

	restoreCustomer(customer: Customer) {
		customer.birthday = customer.birthday ? new Date(customer.birthday) : null;
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
								this.dropdownFormGroup.controls.businessDropdown.disable();
								this.currentSyncEntry = offlineEntry.entry;
								res();
							});
							break;
						case EntitiesComponent.API_URL_PATCH_CUSTOMER:
							this.selectCustomers();
							afterNextRender(async () => {
								await this.customerSelected(this.restoreCustomer(offlineEntry.entry.item["item"]["customer"]));
								this.dropdownFormGroup.controls.customerDropdown.disable();
								this.currentSyncEntry = offlineEntry.entry;
								res();
							});
							break;
						case EntitiesComponent.API_URL_PATCH_DRUG:
							this.selectDrugs();
							afterNextRender(async () => {
								await this.drugSelected(offlineEntry.entry.item["item"]["drug"]);
								this.dropdownFormGroup.controls.drugDropdown.disable();
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
			this.dropdownFormGroup.patchValue({
				mergeConflictBusinessServer: EMPTY_BUSINESS,
				mergeConflictCustomerServer: EMPTY_CUSTOMER,
				mergeConflictDrugServer: EMPTY_DRUG
			});
			console.log("nullify val!");


			let entityTypeEndpoint = this.currentSyncEntry?.item["endpoint"];
			switch (entityTypeEndpoint) {
				case EntitiesComponent.API_URL_PATCH_BUSINESS:
					this.dropdownFormGroup.controls.businessDropdown.enable();
					break;
				case EntitiesComponent.API_URL_PATCH_CUSTOMER:
					this.dropdownFormGroup.controls.customerDropdown.enable();
					break;
				case EntitiesComponent.API_URL_PATCH_DRUG:
					this.dropdownFormGroup.controls.drugDropdown.enable();
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

}