import { Component, HostListener, OnInit, signal, Signal, WritableSignal } from '@angular/core';

@Component({
	selector: 'app-offline-indicator',
	imports: [],
	templateUrl: './offline-indicator.component.html',
	styleUrl: './offline-indicator.component.scss'
})
export class OfflineIndicatorComponent implements OnInit {

	isOnline: WritableSignal<boolean> = signal(false);

	ngOnInit(): void {
		this.isOnline.set(navigator.onLine);
	}

	@HostListener("window:online")
	hostOnline() {
		this.isOnline.set(true);
	}

	@HostListener("window:offline")
	hostOffline() {
		this.isOnline.set(false);
	}
}
