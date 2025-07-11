import { Component, effect, inject, signal, Signal, WritableSignal } from '@angular/core';
import { KeyValuePipe, NgFor } from '@angular/common';
import { ErrorlistService } from './errorlist.service';
import { CacheUpdatePopupComponent } from '../cache-update-popup/cache-update-popup.component';
import { SworkerUiComponent } from '../sworker-ui/sworker-ui.component';
import { ServiceworkerService } from '../../shared-service/serviceworker.service';
import { ModuleService } from '../../module/module.service';
import { DelayedSignalService } from '../../shared-service/delayed-signal.service';
import { PopupmessageComponent } from '../../popupmessage/popupmessage.component';

@Component({
	selector: 'app-popuplist',
	imports: [PopupmessageComponent, CacheUpdatePopupComponent, SworkerUiComponent, NgFor, KeyValuePipe],
	templateUrl: './popuplist.component.html',
	styleUrl: './popuplist.component.scss'
})
export class PopuplistComponent {

	private delayedSignal = inject(DelayedSignalService);
	private moduleService = inject(ModuleService);

	showServiceWorkerOverlay: boolean = false;
	hideBackendCacheUpdateOverlay = this.delayedSignal.delayedBitSetInstantClear(this.moduleService.backendCacheUpdateFinished.bind(this.moduleService), 3000);

	constructor(private errorlistService: ErrorlistService,
		private serviceworkerService: ServiceworkerService,
	) {
		serviceworkerService.newVersionReady.subscribe(() => {
			this.showServiceWorkerOverlay = true;
		});
	}

	trackByFn(index: number, item: any) {
		return item.key;
	}

	removeItem(event: PopupmessageComponent) {
		this.errorlistService.removeErrorMessage(event.id);
	}

	getErrorlist() {
		return this.errorlistService.errors;
	}
}
