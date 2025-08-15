import { Component, computed, Input, signal, Signal } from '@angular/core';

@Component({
	selector: 'app-loading-bar',
	imports: [],
	templateUrl: './loading-bar.component.html',
	styleUrl: './loading-bar.component.scss'
})
export class LoadingBarComponent<T> {

	@Input({required: true})
	value: Signal<T> = signal(0.0 as T);

	@Input({required: true})
	text: string = "generic progress";
	
	@Input({required: false})
	serializer: (val: T) => string = (val) => String(val);
	
	@Input({required: true})
	quantize: (val: T) => number = (val) => val as number;
	
	progress: Signal<number> = computed(() => this.quantize(this.value()));
	progressText = computed(() => this.serializer(this.value()));
}
