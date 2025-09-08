import { Component, ElementRef, Input, ViewChild } from '@angular/core';
import { findThisOrParentWithProperty } from '../utilities/dom-util';

export type Hint = {
	color: string;
	text: string;
	tooltip: string;
};

export const NO_HINT: Hint = { color: 'black', text: '', tooltip: '' };

@Component({
	selector: 'app-hint',
	imports: [],
	templateUrl: './hint.component.html',
	styleUrl: './hint.component.scss'
})
export class HintComponent {

	@Input({required: true})
	hintModel: Hint = NO_HINT

	@ViewChild('tooltip')
	tooltipRef: ElementRef | undefined;

	private elRef: ElementRef;

	constructor(elRef: ElementRef) {
		this.elRef = elRef;
	}

	showTooltip(event: MouseEvent) {
		if (this.tooltipRef) {
			let target = this.elRef.nativeElement as HTMLElement;
			let transformedParent = findThisOrParentWithProperty(target.parentElement as HTMLElement, ["transform", "filter"]);
			let offset = transformedParent ? ({x: transformedParent.getBoundingClientRect().x, y: transformedParent.getBoundingClientRect().y}) : {x: 0, y: 0};
			let html = (this.tooltipRef.nativeElement as HTMLElement);
			html.style.top = (target.getBoundingClientRect().y - html.getBoundingClientRect().height - 10 - offset.y) + "px";
			html.style.left = (target.getBoundingClientRect().x + target.getBoundingClientRect().width/2 - html.getBoundingClientRect().width/2 - offset.x) + "px";
		}
	}
}
