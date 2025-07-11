import { Component, EventEmitter, HostListener, Input, Output } from '@angular/core';

@Component({
	selector: 'app-popupmessage',
	imports: [],
	templateUrl: './popupmessage.component.html',
	styleUrl: './popupmessage.component.scss'
})
export class PopupmessageComponent {
	@Input({required: true}) error!: string;
	@Input({required: true}) id!: string;
	@Output() removeRequested = new EventEmitter<PopupmessageComponent>();

	@HostListener('animationend') animationEnded() {
		this.removeRequested.emit(this);
	}
}
