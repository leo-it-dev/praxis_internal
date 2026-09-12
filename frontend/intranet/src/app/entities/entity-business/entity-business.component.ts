import { afterNextRender, AfterViewInit, Component, effect, ElementRef, inject, Injector, Input, runInInjectionContext, Signal, signal } from '@angular/core';
import { AbstractControl, ControlValueAccessor, FormBuilder, NgControl, ReactiveFormsModule, ValidationErrors, Validators } from '@angular/forms';
import { Business, EMPTY_BUSINESS } from '../../../../../../api_common/generic_types/business';
import { makeUntabbableRecursive } from '../../utilities/dom-util';

@Component({
	selector: 'app-entity-business',
	imports: [ReactiveFormsModule],
	templateUrl: './entity-business.component.html',
	styleUrl: './entity-business.component.scss'
})
export class EntityBusinessComponent implements ControlValueAccessor, AfterViewInit {

	WRITABLE_ENTRIES: (keyof Business)[] = [];

	mergeConflictValidator = (attribute: keyof Business) => {
		return (control: AbstractControl): ValidationErrors | null => {
			let compareDrug = this.compareBusiness();
			if (!compareDrug) {
				return null;
			}

			const validator = control.value !== compareDrug[attribute]
				? { mergeConflict: true }
				: null;
			return validator;
		}
	};

	@Input({required: false})
	public compareBusiness: Signal<Business | null> = signal(null);

	private onChange: (value: Business | undefined) => void = () => { };

	constructor(private controlDir: NgControl, public injector: Injector, private elRef: ElementRef) {
		controlDir.valueAccessor = this;

		this.businessFormGroup.valueChanges.subscribe(() => {
			this.onChange(this.extractBusinessFromForm());
		});

		effect(() => {
			this.compareBusiness();
			Object.values(this.businessFormGroup.controls).forEach(control => control.updateValueAndValidity({emitEvent: false}));
			this.businessFormGroup.updateValueAndValidity({emitEvent: false});
		})
	}

	private formBuilder = inject(FormBuilder);

	businessFormGroup = this.formBuilder.group({
		customerMovetaId: [{ value: "", disabled: true }, Validators.required],
		businessType: [{ value: "", disabled: true }, Validators.required],
		vvvo: [{ value: "", disabled: true }, Validators.required],
		businessDropdown: [{ value: EMPTY_BUSINESS, disabled: false }],
		businessMovetaId: [{ value: "", disabled: true }],
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
		this.businessSelected(obj);
	}
	businessSelected(business: Business | undefined) {
		if (business) {
			this.businessFormGroup.patchValue({
				businessType: business.businessType,
				customerMovetaId: business.customerMovetaId,
				vvvo: business.vvvo,
				changed: business.changed,
				businessMovetaId: business.commonId
			}, {emitEvent: false});

			Object.entries(this.businessFormGroup.controls).filter(e => this.WRITABLE_ENTRIES.includes(e[0] as keyof Business)).forEach(e => e[1].enable({emitEvent: false}));
		} else {
			this.businessFormGroup.disable({emitEvent: false})
			this.businessFormGroup.reset({}, {emitEvent: false})
		}
	}

	extractBusinessFromForm(): Business | undefined {
		this.businessFormGroup.updateValueAndValidity({emitEvent: false});
		if (this.businessFormGroup.value) {
			let value = this.businessFormGroup.getRawValue();
			let business: Business = {
				// readonly
				commonId: value.businessMovetaId!,
				businessType: value.businessType!,
				customerMovetaId: value.customerMovetaId!,
				vvvo: value.vvvo!,
				// writable
				dummy: "",
				changed: value.changed || 0
			};
			// update values here
			return business;
		}
		return undefined;
	}

	ngAfterViewInit(): void {
		if (this.compareBusiness()) {
			makeUntabbableRecursive(this.elRef.nativeElement);
		}
	}
}
