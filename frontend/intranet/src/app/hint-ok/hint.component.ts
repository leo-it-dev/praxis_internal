import { Component, Input } from '@angular/core';

@Component({
	selector: 'app-hint',
	imports: [],
	templateUrl: './hint.component.html',
	styleUrl: './hint.component.scss'
})
export class HintComponent {

	@Input({required:true})
	hintText: string = "";
	@Input({required:true})
	hintColor: string = "#000";

}
