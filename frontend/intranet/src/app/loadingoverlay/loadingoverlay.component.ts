import { AfterViewInit, Component, ElementRef, OnDestroy } from '@angular/core';

@Component({
	selector: 'app-loadingoverlay',
	imports: [],
	templateUrl: './loadingoverlay.component.html',
	styleUrl: './loadingoverlay.component.scss'
})
export class LoadingoverlayComponent implements AfterViewInit, OnDestroy {

	constructor(private elRef: ElementRef) { }

	ngAfterViewInit() { }

	ngOnDestroy() { }
}
