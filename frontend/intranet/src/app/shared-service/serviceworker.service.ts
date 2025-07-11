import { EventEmitter, Injectable, Output } from '@angular/core';
import { SwUpdate } from '@angular/service-worker';
import { ModuleService } from '../module/module.service';

@Injectable({
	providedIn: 'root'
})
export class ServiceworkerService {

	@Output()
	newVersionReady: EventEmitter<void> = new EventEmitter<void>();

	constructor(updates: SwUpdate,
		private moduleService: ModuleService
	) {
		updates.versionUpdates.subscribe((evt) => {
			switch(evt.type) {
				case 'VERSION_DETECTED':
					console.log(`Downloading new app version: ${evt.version.hash}`);
					break;
				case 'VERSION_READY':
					console.log(`Current app version: ${evt.currentVersion.hash}`);
					console.log(`New app version ready for use: ${evt.latestVersion.hash}`);
					this.newVersionReady.emit();
					break;
				case 'VERSION_INSTALLATION_FAILED':
					console.log(`Failed to install app version ${evt.version.hash}: ${evt.error}`)	
					break;
				case 'NO_NEW_VERSION_DETECTED':
					console.log(`App version is up-to-date: ${evt.version.hash}`);
					break;
			}
		});
	}
}
