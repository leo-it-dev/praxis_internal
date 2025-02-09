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
		} else if(event.key == 'Enter') {
			if (currentEnteredDate) {
				this.setDate(currentEnteredDate);
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

	parseDate(): Date | undefined {
		let searchString = (this.input!.nativeElement as HTMLInputElement).value;
		let dateParts = searchString.split(".");
		let date = undefined;

		if (dateParts.length >= 2) {
			let dayStr = dateParts[0];
			let monthStr = dateParts[1];
			let year = new Date().getFullYear();
			if (dayStr.length == 1) dayStr = '0' + dayStr;
			if (monthStr.length == 1) monthStr = '0' + monthStr;

			if (dateParts.length == 3) {
				let yearStr = dateParts[2];
				let yearNowStr = String(new Date().getFullYear());
				console.log(yearNowStr);
				if (yearStr.length < yearNowStr.length) {
					yearStr = yearNowStr.substring(0, yearNowStr.length - yearStr.length) + yearStr;
				}
				year = parseInt(yearStr);
			}
			date = new Date(year, parseInt(monthStr) - 1, parseInt(dayStr));
		}
		return date;
	}

	lostFocus(event: Event) {
		let currentEnteredDate = this.parseDate();
		if (currentEnteredDate) {
			this.setDate(currentEnteredDate);
		}
	}
}
