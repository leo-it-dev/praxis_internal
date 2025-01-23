import { Injectable } from '@angular/core';

@Injectable({
	providedIn: 'root'
})
export class ErrorlistService {

	private cntr: number = 0;
	errors: { [key: string]: string } = {};

	constructor() {
		this.restoreMessages();
	}

	storeMessages() {
		sessionStorage.setItem("errors", JSON.stringify(this.errors));
	}

	restoreMessages() {
		const errorStr = sessionStorage.getItem("errors");
		if (errorStr !== null) {
			this.errors = JSON.parse(errorStr);
		} else {
			this.errors = {};
		}

		let errorCounters = Object.keys(this.errors).map(i => parseInt(i));
		errorCounters.push(-1);
		this.cntr = Math.max(...errorCounters) + 1;
		console.log("Loaded error counter: ", this.cntr);
	}

	showErrorMessage(msg: string) {
		this.errors[this.cntr++ + ""] = msg;
		console.error("Displaying error message: ", msg);
		this.storeMessages();
	}

	removeErrorMessage(id: string) {
		delete this.errors[id];
		this.storeMessages();
	}
}
