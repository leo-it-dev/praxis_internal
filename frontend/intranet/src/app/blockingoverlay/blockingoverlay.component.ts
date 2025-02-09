import { NgFor } from '@angular/common';
import { AfterViewInit, Component, ElementRef, EventEmitter, Input, Output } from '@angular/core';

export enum OverlayButtonDesign {
	PRIMARY_COLORED = 0,
	BASIC_BLANK
};

export type OverlayButton = {
	design: OverlayButtonDesign;
	text: string;
	id: number;
};

@Component({
	selector: 'app-blockingoverlay',
	imports: [NgFor],
	templateUrl: './blockingoverlay.component.html',
	styleUrl: './blockingoverlay.component.scss'
})
export class BlockingoverlayComponent implements AfterViewInit {

	constructor(private elRef: ElementRef) { }

	@Input({ required: false }) overlayTitle: string = "Test title";
	@Input({ required: false }) overlayContent: string = "Some informative content";
	@Input({ required: false }) buttons: OverlayButton[] = [
		{ design: OverlayButtonDesign.BASIC_BLANK, id: 1, text: "Ignorieren" },
		{ design: OverlayButtonDesign.BASIC_BLANK, id: 2, text: "Schließen" },
		{ design: OverlayButtonDesign.PRIMARY_COLORED, id: 3, text: "Übernehmen" },
	];
	@Output() selectionMade = new EventEmitter<OverlayButton>();

	buttonClicked(event: Event) {
		const target = (event.target as HTMLElement);
		if (target.hasAttribute("answerId")) {
			const answerId = parseInt(target.getAttribute("answerId")!);
			this.selectionMade.emit(this.buttons.find(b => b.id == answerId))
		}
	}

	ngAfterViewInit() {
		const natElement = (this.elRef.nativeElement) as HTMLElement;
		const buttons = natElement.getElementsByTagName("button");
		if (buttons.length >= 1) {
			buttons[0].focus();
		}
	}
}
