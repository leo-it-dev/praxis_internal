import { Injectable, signal } from '@angular/core';

@Injectable({
	providedIn: 'root'
})
export class LoadingoverlayService {

	loadingOverlayVisible = signal(false);

	constructor() {
		
	}

	showLoadingOverlay() {
		this.loadingOverlayVisible.set(true);
	}
	hideLoadingOverlay() {
		this.loadingOverlayVisible.set(false);
	}
}
