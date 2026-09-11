import { afterNextRender, Component, inject, Injector, Input, runInInjectionContext } from '@angular/core';
import { ControlValueAccessor, FormBuilder, NgControl, ReactiveFormsModule, Validators } from '@angular/forms';
import { Business, EMPTY_BUSINESS } from '../../../../../../api_common/generic_types/business';

@Component({
	selector: 'app-entity-business',
	imports: [ReactiveFormsModule],
	templateUrl: './entity-business.component.html',
	styleUrl: './entity-business.component.scss'
})
export class EntityBusinessComponent implements ControlValueAccessor {

	private onChange: (value: Business | undefined) => void = () => { };

	@Input({required: false})
	public compareBusiness: Business | undefined;

	constructor(private controlDir: NgControl, public injector: Injector) {
		controlDir.valueAccessor = this;

		this.businessFormGroup.valueChanges.subscribe(() => {
			this.onChange(this.extractBusinessFromForm());
		});
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
		let writableEntries: (keyof Business)[] = [];

		if (business) {
			runInInjectionContext(this.injector, () => afterNextRender(() => this.businessFormGroup.patchValue({
				businessType: business.businessType,
				customerMovetaId: business.customerMovetaId,
				vvvo: business.vvvo,
				changed: business.changed,
				businessMovetaId: business.commonId
			})));

			if (this.compareBusiness == undefined) {
				Object.entries(this.businessFormGroup.controls).filter(e => writableEntries.includes(e[0] as keyof Business)).forEach(e => e[1].enable());
			} else {
				this.businessFormGroup.disable();
				for (let writableEntry of writableEntries) {
					if (business[writableEntry] != this.compareBusiness![writableEntry]) {
						let mergeConflictControl = Object.entries(this.businessFormGroup.controls).find(e => e[0] == writableEntry);
						if (mergeConflictControl) {
							mergeConflictControl[1].setErrors({
								mergeConflict: true
							});
						}
					}
				}
			}

		} else {
			Object.entries(this.businessFormGroup.controls).filter(e => writableEntries.includes(e[0] as keyof Business)).forEach(e => e[1].disable());
			Object.keys(this.businessFormGroup.controls).filter(c => c != 'businessDropdown').forEach(c => this.businessFormGroup.get(c)?.reset());
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



}
