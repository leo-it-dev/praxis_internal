import { NgFor } from '@angular/common';
import { Component, OnInit, signal, Signal } from '@angular/core';
import { Module, ModuleService } from '../module/module.service';
import { DelayedSignalService } from '../shared-service/delayed-signal.service';

@Component({
  selector: 'app-cache-update-popup',
  imports: [NgFor],
  templateUrl: './cache-update-popup.component.html',
  styleUrl: './cache-update-popup.component.scss'
})
export class CacheUpdatePopupComponent {

	_moduleService: ModuleService;
	_delayedPopupHide: Signal<boolean> = signal(false);

	constructor(private modService: ModuleService,
		private delayedSignal: DelayedSignalService
	) {
		this._moduleService = modService;
		this._delayedPopupHide = this.delayedSignal.delayedBitSetInstantClear(this._moduleService.backendCacheUpdateFinished.bind(this._moduleService), 3000);
	}

	trackByModule(index: number, obj: Module) {
		return {i: index, inprog: obj.backendCacheUpdateInProgress(), res: obj.backendCacheUpdateResult()};
	}
}
