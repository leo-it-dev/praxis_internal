import { AfterViewInit, Component, effect, ElementRef, inject, Injector, Input, Signal, signal } from '@angular/core';
import { AbstractControl, ControlValueAccessor, EmailValidator, FormBuilder, FormControl, NgControl, ReactiveFormsModule, ValidationErrors } from '@angular/forms';
import { Customer } from '../../../../../../api_common/generic_types/customer';
import { DatepickerComponent } from '../../datepicker/datepicker.component';
import { ImagePickerComponent } from '../../image-picker/image-picker.component';
import { makeUntabbableRecursive } from '../../utilities/dom-util';

@Component({
	selector: 'app-entity-customer',
	imports: [ReactiveFormsModule, DatepickerComponent, ImagePickerComponent],
	templateUrl: './entity-customer.component.html',
	styleUrl: './entity-customer.component.scss'
})
export class EntityCustomerComponent implements ControlValueAccessor, AfterViewInit {

	WRITABLE_ENTRIES: (keyof Customer)[] = [
		'altgpsplace',
		'altgpsplz',
		'altgpsstreet',
		'nonpaying',
		'image'
	];

	mergeConflictValidator = (attribute: keyof Customer) => {
		return (control: AbstractControl): ValidationErrors | null => {
			let compareCustomer = this.compareCustomer();
			if (!compareCustomer) {
				return null;
			}

			const validator = control.value !== compareCustomer[attribute]
				? { mergeConflict: true }
				: null;
			return validator;
		}
	};

	@Input({required: false})
	public compareCustomer: Signal<Customer | null> = signal(null);

	private onChange: (value: Customer | undefined) => void = () => {};

	constructor(private controlDir: NgControl, public injector: Injector, private elRef: ElementRef) {
		controlDir.valueAccessor = this;

		this.customerFormGroup.valueChanges.subscribe(() => {
			// this.controlDir.control?.markAsDirty();
			console.log("dirty: ", this.controlDir.dirty);
			this.onChange(this.extractCustomerFromForm());
		});

		effect(() => {
			this.compareCustomer();
			Object.values(this.customerFormGroup.controls).forEach(control => control.updateValueAndValidity({emitEvent: false}));
			this.customerFormGroup.updateValueAndValidity({emitEvent: false});
		})
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
		image: new FormControl<string>({ value: "", disabled: true }, [this.mergeConflictValidator("image")]),
		nonpaying: new FormControl<boolean>({ value: false, disabled: true }, [this.mergeConflictValidator("nonpaying")]),
		altgpsstreet: new FormControl<string>({ value: "", disabled: true }, [this.mergeConflictValidator("altgpsstreet")]),
		altgpsplz: new FormControl<number>({ value: 0, disabled: true }, [this.mergeConflictValidator("altgpsplz")]),
		altgpsplace: new FormControl<string>({ value: "", disabled: true }, [this.mergeConflictValidator("altgpsplace")]),
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
		if (customer) {
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

			Object.entries(this.customerFormGroup.controls).filter(e => this.WRITABLE_ENTRIES.includes(e[0] as keyof Customer)).forEach(e => e[1].enable({emitEvent: false}));
		} else {
			this.customerFormGroup.disable({emitEvent: false});
			this.customerFormGroup.reset({}, {emitEvent: false});
		}
	}

	extractCustomerFromForm(): Customer | undefined {
		this.customerFormGroup.updateValueAndValidity({emitEvent: false});
		if (this.customerFormGroup.value) {
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

	ngAfterViewInit(): void {
		if (this.compareCustomer()) {
			makeUntabbableRecursive(this.elRef.nativeElement);
		}
	}
}
