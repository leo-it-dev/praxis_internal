import { ChangeDetectorRef, Component, inject, Injector, Input } from '@angular/core';
import { FormBuilder, FormControl, NgControl, ReactiveFormsModule, Validators } from '@angular/forms';

export interface IPlaceholderSerializer<T> {
	serialize(value: T): string;
}

@Component({
	selector: 'app-placeholder-field',
	imports: [ReactiveFormsModule],
	templateUrl: './placeholder-field.component.html',
	styleUrl: './placeholder-field.component.scss'
})
export class PlaceholderFieldComponent<TType> {

	@Input({required: true})
	serializer!: IPlaceholderSerializer<TType>;

	injector: Injector;

	constructor(injector: Injector,
		private controlDir: NgControl,
	) {
		this.injector = injector;
		controlDir.valueAccessor = this;
	}

	private formBuilder = inject(FormBuilder);
	public formGroup = this.formBuilder.group({
		placeholder: [{value: "", disabled: true}, Validators.required]
	});

	/* =========== Value Validation =========== */

	writeValue(obj: TType): void {
		this.formGroup.setValue({
			placeholder: this.serializer?.serialize(obj)
		})
	}
	registerOnChange(fn: any): void {}
	registerOnTouched(fn: any): void {}

	get control(): FormControl {
		return this.controlDir.control as FormControl;
	}
}