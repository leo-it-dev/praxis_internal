import { AfterViewInit, Component, ElementRef, Input, ViewChild } from '@angular/core';

@Component({
	selector: 'app-datepicker',
	imports: [],
	templateUrl: './datepicker.component.html',
	styleUrl: './datepicker.component.scss'
})
export class DatepickerComponent implements AfterViewInit {

	@ViewChild("dateinput") input: ElementRef | undefined;
	@ViewChild("todayButton") todayButton: ElementRef | undefined;

	@Input({required: true}) placeholder: string = "Choose date...";

	ngAfterViewInit() {
		this.setDateToToday();
	}

	isToday(date: Date) {
		let rightNow = new Date();
		return date.getDate() == rightNow.getDate() && date.getMonth() == rightNow.getMonth() && date.getFullYear() == rightNow.getFullYear();
	}

	setDate(date: Date) {
		if (this.input) {
			(this.input.nativeElement as HTMLInputElement).value = 
			new String(date.getDate()).padStart(2, '0') + "." + 
			new String(date.getMonth() + 1).padStart(2, '0') + "." + 
			new String(date.getFullYear()).padStart(2, '0');
			this.updateTodayButtonVisibility();
		}
	}

	updateTodayButtonVisibility() {
		let date = this.parseDate();
		if (this.todayButton) {
			let todayButtonVisible = false;
			if (!date || !this.isToday(date)) {
				todayButtonVisible = true;
			}
			if (todayButtonVisible) {
				this.todayButton.nativeElement.classList.remove("hidden");
			} else {
				this.todayButton.nativeElement.classList.add("hidden");
			}
		}
	}

	parseDate(): Date | null {
		if (this.input) {
			let dateParts = (this.input.nativeElement as HTMLInputElement).value.split(".");
			if (dateParts.length == 3) {
				let date = new Date(parseInt(dateParts[2]), parseInt(dateParts[1]) - 1, parseInt(dateParts[0]));
				return date;
			}
		}
		return null;
	}

	keyDownPressed(event: KeyboardEvent) {
		let currentEnteredDate = this.parseDate();

		if (event.key == "ArrowDown") {
			if (currentEnteredDate) {
				currentEnteredDate.setDate(currentEnteredDate.getDate() - 1);
				this.setDate(currentEnteredDate);
			} else {
				this.setDateToToday();
			}
			event.preventDefault();
		} else if (event.key == "ArrowUp") {
			if (currentEnteredDate) {
				currentEnteredDate.setDate(currentEnteredDate.getDate() + 1);
				this.setDate(currentEnteredDate);
				event.preventDefault();
			} else {
				this.setDateToToday();
			}
		}

		setTimeout(() => {
			this.updateTodayButtonVisibility();
		}, 0);
	}

	inputSelected(event: Event) {
		// let el = event.target as HTMLInputElement;
		// el.selectionStart = el.selectionEnd;
	}

	setDateToToday() {
		this.setDate(new Date());
	}

	inputChanged(event: Event) {
	}
}
