import { NgFor } from '@angular/common';
import { AfterViewInit, Component, effect, ElementRef, inject, Injector, Input, Signal, signal } from '@angular/core';
import { AbstractControl, ControlValueAccessor, FormArray, FormBuilder, FormControl, NgControl, ReactiveFormsModule, ValidationErrors, Validators } from '@angular/forms';
import { Drug, DrugPackage, DrugVerifiedState } from '../../../../../../api_common/generic_types/drug';
import { NO_HINT } from '../../hint-ok/hint.component';
import { IPlaceholderSerializer } from '../../placeholder-field/placeholder-field.component';
import { IStringify, SearchDropdownComponent } from '../../search-dropdown/search-dropdown.component';
import { makeUntabbableRecursive } from '../../utilities/dom-util';

@Component({
	selector: 'app-entity-drug',
	imports: [ReactiveFormsModule, NgFor, SearchDropdownComponent],
	templateUrl: './entity-drug.component.html',
	styleUrl: './entity-drug.component.scss'
})
export class EntityDrugComponent implements ControlValueAccessor, AfterViewInit {

	WRITABLE_ENTRIES: (keyof Drug)[] = ['reportabilityVerifierMarkedErronous'];

	mergeConflictValidator = (attribute: keyof Drug) => {
		return (control: AbstractControl): ValidationErrors | null => {
			let compareDrug = this.compareDrug();
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
	public compareDrug: Signal<Drug | null> = signal(null);

	private onChange: (value: Drug | undefined) => void = () => { };

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

	constructor(private controlDir: NgControl, public injector: Injector, private elRef: ElementRef) {
		controlDir.valueAccessor = this;

		this.drugFormGroup.valueChanges.subscribe(() => {
			this.onChange(this.extractDrugFromForm());
		});

		effect(() => {
			this.compareDrug();
			Object.values(this.drugFormGroup.controls).forEach(control => control.updateValueAndValidity({emitEvent: false}));
			this.drugFormGroup.updateValueAndValidity({emitEvent: false});
		})
	}

	private formBuilder = inject(FormBuilder);

	drugFormGroup = this.formBuilder.group({
		znr: [{ value: "", disabled: true }],
		name: [{ value: "", disabled: true }],

		forms: this.formBuilder.array([new FormControl<DrugPackage>({} as DrugPackage, Validators.required)]),

		shortsearch: [{ value: "", disabled: true }, Validators.required],
		reportabilityVerifierMarkedErronous: new FormControl<DrugVerifiedState | null>({value: DrugVerifiedState.eNOT_TESTED, disabled: true}, this.mergeConflictValidator("reportabilityVerifierMarkedErronous")),
		commonId: [{ value: "", disabled: true }],
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
		this.drugSelected(obj);
	}

	drugSelected(drug: Drug | undefined) {
		if (drug) {
			this.drugFormGroup.patchValue({
				forms: drug.forms,
				name: drug.name,
				shortsearch: drug.shortsearch,
				znr: drug.znr,
				commonId: drug.commonId,
				reportabilityVerifierMarkedErronous: drug.reportabilityVerifierMarkedErronous,
				changed: drug.changed
			}, {emitEvent: false})

			Object.entries(this.drugFormGroup.controls).filter(e => this.WRITABLE_ENTRIES.includes(e[0] as keyof Drug)).forEach(e => e[1].enable({emitEvent: false}));
		} else {
			this.drugFormGroup.disable({emitEvent: false});
			this.drugFormGroup.reset({}, {emitEvent: false})
		}
	}

	extractDrugFromForm(): Drug | undefined {
		this.drugFormGroup.updateValueAndValidity({emitEvent: false});
		if (this.drugFormGroup.value) {
			let value = this.drugFormGroup.getRawValue();
			let drug: Drug = {
				// read only
				name: value.name!,
				shortsearch: value.shortsearch!,
				znr: value.znr!,
				forms: value.forms.map(f => f!),
				commonId: value.commonId!,
				// writable
				reportabilityVerifierMarkedErronous: value.reportabilityVerifierMarkedErronous ?? DrugVerifiedState.eNOT_TESTED,
				changed: value.changed || 0
			};
			return drug;
		}
		return undefined;
	}

	get drugForms() {
		return this.drugFormGroup.get('forms') as FormArray;
	} 

	ngAfterViewInit(): void {
		if (this.compareDrug()) {
			makeUntabbableRecursive(this.elRef.nativeElement);
		}
	}
}
