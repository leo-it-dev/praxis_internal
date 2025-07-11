import { NgFor } from '@angular/common';
import { Component, EventEmitter, HostListener, OnInit, Output, signal, Signal } from '@angular/core';
import { Module, ModuleService } from '../../module/module.service';
import { DelayedSignalService } from '../../shared-service/delayed-signal.service';

@Component({
  selector: 'app-cache-update-popup',
  imports: [NgFor],
  templateUrl: './cache-update-popup.component.html',
  styleUrl: './cache-update-popup.component.scss'
})
export class CacheUpdatePopupComponent {

	_moduleService: ModuleService;

	constructor(private modService: ModuleService,
		private delayedSignal: DelayedSignalService
	) {
		this._moduleService = modService;
	}

	trackByModule(index: number, obj: Module) {
		return {i: index, inprog: obj.backendCacheUpdateInProgress(), res: obj.backendCacheUpdateResult()};
	}
}
