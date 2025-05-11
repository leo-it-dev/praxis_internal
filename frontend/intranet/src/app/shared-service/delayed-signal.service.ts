import { effect, Signal, signal, Injectable, runInInjectionContext, Injector } from '@angular/core';

@Injectable({
	providedIn: 'root'
})
export class DelayedSignalService {

	constructor(private injector: Injector) {}

	delayedBitSetInstantClear<T>(source: () => boolean, delayMs: number): Signal<boolean> {
		const delayed = signal<boolean>(source());

		runInInjectionContext(this.injector, () => {
			effect(() => {
				const value = source();
				if (value === true) {
					setTimeout(() => {
						delayed.set(true);
					}, delayMs);
				} else {
					delayed.set(false);
				}
			});
		});

		return delayed;
	}

}
