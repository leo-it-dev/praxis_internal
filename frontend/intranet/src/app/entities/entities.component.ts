import { Component, inject, signal, WritableSignal } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { ModuleComponent } from '../module/module/module.component';
import { EntitiesBackendFetch, EntitiesBackendService } from '../modules/entities/entities-backend.service';
import { LoggedOutSvgComponent } from '../logged-out-svg/logged-out-svg.component';
import { IStringify, SearchDropdownComponent } from '../search-dropdown/search-dropdown.component';
import { Customer } from '../../../../../api_common/generic_types/customer';
import { NO_HINT } from '../hint-ok/hint.component';
import { DatepickerComponent } from '../datepicker/datepicker.component';
import { Drug } from '../../../../../api_common/generic_types/drug';
import { Business } from '../../../../../api_common/generic_types/business';

export enum EntityType {
    CUSTOMER,
    BUSINESS,
    DRUG,
}

@Component({
	selector: 'app-entities',
	imports: [ReactiveFormsModule, LoggedOutSvgComponent, SearchDropdownComponent, DatepickerComponent],
	templateUrl: './entities.component.html',
	styleUrl: './entities.component.scss'
})
export class EntitiesComponent extends ModuleComponent {

	selectedEntityType = EntityType.CUSTOMER;

	customerList: WritableSignal<Customer[]> = signal([]);
	businessList: WritableSignal<Business[]> = signal([]);
	drugsList: WritableSignal<Drug[]> = signal([]);
	customerSerializer: IStringify<Customer> = { display: (customer) => ({ text: customer.moveta.firstName + " " + customer.moveta.givenName, hint: NO_HINT }) };
	businessSerializer: IStringify<Business> = { display: (business) => ({ text: business.moveta.commonId + " " + business.moveta.businessType + " " + business.moveta.vvvo, hint: NO_HINT }) };
	drugSerializer: IStringify<Drug> = { display: (drug) => ({ text: (drug.moveta.name||drug.hit.name) + " - " + drug.moveta.forms.map(form => form.package + " " + form.unitSuggestion?.name).join(", "), hint: NO_HINT }) };

	private formBuilder = inject(FormBuilder);
	customerFormGroup = this.formBuilder.group({
		firstName: [{value: "", disabled: true}, Validators.required],
		givenName: [{value: "", disabled: true}, Validators.required],
		search: [{value: "", disabled: true}, Validators.required],
		street: [{value: "", disabled: true}, Validators.required],
		plz: [{value: 0, disabled: true}, Validators.required],
		place: [{value: "", disabled: true}, Validators.required],
		phone: [{value: "", disabled: true}],
		memo: [{value: "", disabled: true}],
		fax: [{value: "", disabled: true}],
		email: [{value: "", disabled: true}, Validators.required],
		birthday: [{value: "", disabled: true}], // check if is correct date
		uid: [{value: 0, disabled: true}, Validators.required],
		movetaCustomerId: [{value: "", disabled: true}, Validators.required],

		image: [{value: "", disabled: false}, Validators.required],
		nonpaying: [{value: false, disabled: false}, Validators.required],
		altgpsstreet: [{value: "", disabled: false}, Validators.required],
		altgpsplz: [{value: "", disabled: false}, Validators.required],
		altgpsplace: [{value: "", disabled: false}, Validators.required],

		customerDropdown: [{value: "", disabled: true}, Validators.required]
	});

	businessFormGroup = this.formBuilder.group({
		customerMovetaId: [{value: "", disabled: true}, Validators.required],
		businessType: [{value: "", disabled: true}, Validators.required],
		vvvo: [{value: "", disabled: true}, Validators.required],
		businessDropdown: [{value: "", disabled: true}, Validators.required]
	});

	drugFormGroup = this.formBuilder.group({
		znr: [{value: "", disabled: true}, Validators.required],
		name: [{value: "", disabled: true}, Validators.required],
		forms: [{value: "", disabled: true}, Validators.required],
		shortsearch: [{value: "", disabled: true}, Validators.required],
		qsReportabilityState: [{value: "", disabled: false}, Validators.required],
		drugDropdown: [{value: "", disabled: true}, Validators.required]
	});

	businessSelected(business: Business | undefined) {
	}
	drugSelected(drug: Drug | undefined) {
	}

	customerSelected(customer: Customer | undefined) {
		if (customer) {
			console.log("new customer selected: ", customer);
			this.customerFormGroup.patchValue({
				firstName: customer.moveta.firstName,
				givenName: customer.moveta.givenName,
				search: customer.moveta.search,
				street: customer.moveta.street,
				plz: customer.moveta.plz,
				place: customer.moveta.place,
				phone: customer.moveta.phone || "",
				memo: customer.moveta.memo || "",
				fax: customer.moveta.fax || "",
				email: customer.moveta.email,
				birthday: customer.moveta.birthday ? DatepickerComponent.serializeDateGerman(customer.moveta.birthday) : "",
				uid: customer.moveta.uid,
				movetaCustomerId: customer.moveta.commonId
			});
		} else {
			Object.keys(this.customerFormGroup.controls).filter(c => c != 'customerDropdown').forEach(c => this.customerFormGroup.get(c)?.reset());
		}
	}

	override afterViewInit(): void {

	}

	constructor() {
		super(EntitiesBackendService);
		Promise.allSettled([this.getBackendService().fetchBackendData()]).then((proms) => {
			let backendCustomerProms = proms[0] as PromiseSettledResult<EntitiesBackendFetch>;

			if (backendCustomerProms.status == 'fulfilled') {
				this.customerList.set(backendCustomerProms.value.customers);
				console.log("Loaded " + this.customerList().length + " customers!");
			}
		});
	}

	selectCustomers() { this.selectedEntityType = EntityType.CUSTOMER }
	selectBusinesses() { this.selectedEntityType = EntityType.BUSINESS }
	selectDrugs() { this.selectedEntityType = EntityType.DRUG }
	isBusinessSelected() { return this.selectedEntityType == EntityType.BUSINESS }
	isCustomersSelected() { return this.selectedEntityType == EntityType.CUSTOMER }
	isDrugsSelected() { return this.selectedEntityType == EntityType.DRUG }
}
