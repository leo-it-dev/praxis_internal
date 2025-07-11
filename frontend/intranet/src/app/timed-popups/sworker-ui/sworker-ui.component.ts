import { NgFor } from '@angular/common';
import { Component } from '@angular/core';
import { Module, ModuleService } from '../../module/module.service';
import { ServiceworkerService } from '../../shared-service/serviceworker.service';

@Component({
	selector: 'app-sworker-ui',
	imports: [],
	templateUrl: './sworker-ui.component.html',
	styleUrl: './sworker-ui.component.scss'
})
export class SworkerUiComponent {

	sworker: ServiceworkerService;

	constructor(sworkerServ: ServiceworkerService,
	) {
		this.sworker = sworkerServ;
	}

	reloadPage() {
		document.location.reload();
	}
}
