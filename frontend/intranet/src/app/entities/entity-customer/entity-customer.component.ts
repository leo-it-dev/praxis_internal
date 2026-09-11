import { afterNextRender, Component, inject, Injector, Input, runInInjectionContext } from '@angular/core';
import { ControlValueAccessor, FormBuilder, NgControl, ReactiveFormsModule } from '@angular/forms';
import { Customer } from '../../../../../../api_common/generic_types/customer';
import { DatepickerComponent } from '../../datepicker/datepicker.component';
import { ImagePickerComponent } from '../../image-picker/image-picker.component';

@Component({
	selector: 'app-entity-customer',
	imports: [ReactiveFormsModule, DatepickerComponent, ImagePickerComponent],
	templateUrl: './entity-customer.component.html',
	styleUrl: './entity-customer.component.scss'
})
export class EntityCustomerComponent implements ControlValueAccessor {

	private onChange: (value: Customer | undefined) => void = () => {};

	@Input({required: false})
	public compareCustomer: Customer | undefined;

	constructor(private controlDir: NgControl, public injector: Injector) {
		controlDir.valueAccessor = this;

		// this.customerFormGroup.valueChanges.subscribe(() => {
		// 	this.onChange(this.extractCustomerFromForm());
		// });
	}

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
		image: [{ value: "", disabled: true }],
		nonpaying: [{ value: false, disabled: true }],
		altgpsstreet: [{ value: "", disabled: true }],
		altgpsplz: [{ value: 0, disabled: true }],
		altgpsplace: [{ value: "", disabled: true }],
		changed: [0],
	});

	registerOnChange(fn: any): void {
		this.onChange = fn;
	}
	registerOnTouched(fn: any): void {
		
	}
	setDisabledState(isDisabled: boolean): void {
		
	}
	writeValue(obj: any): void {
		this.customerSelected(obj);
	}

	customerSelected(customer: Customer | undefined) {
		let writableEntries: (keyof Customer)[] = [
			'altgpsplace',
			'altgpsplz',
			'altgpsstreet',
			'nonpaying',
			'image'
		];
		if (customer) {
			runInInjectionContext(this.injector, () => afterNextRender(() => 
				{
					this.customerFormGroup.patchValue({
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

					changed: customer.changed,
					altgpsplace: customer.altgpsplace,
					altgpsplz: customer.altgpsplz,
					altgpsstreet: customer.altgpsstreet,
					nonpaying: customer.nonpaying,
					image: customer.image
				}, {emitEvent: false})
				this.customerFormGroup.updateValueAndValidity({emitEvent: true});
			}));

			if (this.compareCustomer == undefined) {
				Object.entries(this.customerFormGroup.controls).filter(e => writableEntries.includes(e[0] as keyof Customer)).forEach(e => e[1].enable());
			} else {
				this.customerFormGroup.disable();
				for (let writableEntry of writableEntries) {
					if (customer[writableEntry] != this.compareCustomer![writableEntry]) {
						let mergeConflictControl = Object.entries(this.customerFormGroup.controls).find(e => e[0] == writableEntry);
						if (mergeConflictControl) {
							mergeConflictControl[1].setErrors({
								mergeConflict: true
							});
						}
					}
				}
			}
		} else {
			Object.entries(this.customerFormGroup.controls).filter(e => writableEntries.includes(e[0] as keyof Customer)).forEach(e => e[1].disable());
			Object.keys(this.customerFormGroup.controls).filter(c => c != 'customerDropdown').forEach(c => this.customerFormGroup.get(c)?.reset());
		}
	}

	extractCustomerFromForm(): Customer | undefined {
		this.customerFormGroup.updateValueAndValidity({emitEvent: false});
		let value = this.customerFormGroup.getRawValue();
		if (value) {
			// We need to populate commonId=movetaCustomerId so the server can identify which entry to modify.
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
				birthday: value.birthday ? new Date(value.birthday) : null,
				uid: value.uid!,
				// writable
				image: value.image || "",
				nonpaying: value.nonpaying || false,
				altgpsstreet: value.altgpsstreet || null,
				altgpsplz: value.altgpsplz || null,
				altgpsplace: value.altgpsplace || null,

				commonId: value.movetaCustomerId!,
				changed: value.changed || 0
			};
			return customer;
		}
		return undefined;
	}
}
