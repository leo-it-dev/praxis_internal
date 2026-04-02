import { AfterViewInit, Component, ElementRef, HostListener, signal, WritableSignal } from '@angular/core';

@Component({
	selector: 'app-trash-svg',
	imports: [],
	templateUrl: '../../../public/images/trash.svg',
	styleUrl: './trash-svg.component.scss'
})
export class TrashSvgComponent {
	color: WritableSignal<string> = signal("black");

	constructor(private elRef: ElementRef) {
		(elRef.nativeElement as HTMLElement).addEventListener("mouseenter", () => {
			this.color.set("red");
		});
		(elRef.nativeElement as HTMLElement).addEventListener("mouseleave", () => {
			this.color.set("black");
		});
	}
}
