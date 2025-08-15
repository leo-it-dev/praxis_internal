import { Component, signal } from '@angular/core';
import { LoadingBarComponent } from '../loading-bar/loading-bar.component';

let test = ["A", "B", "C", "D", "E"];

@Component({
	selector: 'app-system-overview',
	imports: [LoadingBarComponent],
	templateUrl: './system-overview.component.html',
	styleUrl: './system-overview.component.scss'
})
export class SystemOverviewComponent {

	public progress1 = signal(test[3]);
	public progress2 = signal(0.4);

	quantize1(val: string) {
		return (test.indexOf(val)+1) / test.length;
	}
	quantize2(val: number) {
		return val;
	}

	serial1(val: string) {
		return "Text: " + val;
	}
	serial2(val: number) {
		return "Value Idx: " + val;
	}
}
