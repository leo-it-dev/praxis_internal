import { Component, EventEmitter, HostListener, Input, Output } from '@angular/core';

@Component({
	selector: 'app-errormessage',
	imports: [],
	templateUrl: './errormessage.component.html',
	styleUrl: './errormessage.component.scss'
})
export class ErrormessageComponent {
	@Input({required: true}) error!: string;
	@Input({required: true}) id!: string;
	@Output() removeRequested = new EventEmitter<ErrormessageComponent>();
	
	@HostListener('animationend') animationEnded() {
		this.removeRequested.emit(this);
	}
}
