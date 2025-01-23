import { NgFor } from '@angular/common';
import { Component, ElementRef, EventEmitter, Input, Output, Signal, signal, ViewChild, WritableSignal } from '@angular/core';

export interface IStringify<T> {
	display(obj: T): string;
}

@Component({
	selector: 'app-search-dropdown',
	imports: [NgFor],
	templateUrl: './search-dropdown.component.html',
	styleUrl: './search-dropdown.component.scss'
})
export class SearchDropdownComponent<TItem> {
	private _items?: TItem[];
	private _placeholder: string = "<unset>";

	@Input({required: true}) 
	get placeholder() {
		return this._placeholder;
	}
	set placeholder(placeholder: string) {
		this._placeholder = placeholder;
		this.hintText.set(placeholder);
	}

	@Input({required: true}) 
	set items(items: TItem[]) {
		if (!items) {
			items = [];
		}

		this._items = items;
		this.recommendedItems.set(this._items);

		if (this.inputElement) {
			if (items.length == 1) {
				this.inputElement.nativeElement.value = this.serial.display(items[0]);
			} else {
				this.inputElement.nativeElement.value = "";
			}
			this.updateUIAfterInputValueChange();
		}

		this.itemSelectedEvent.emit(undefined);
	}

	@Input({required: true}) serial: IStringify<TItem> = {display: (e) => String.apply(e)};

	@Output() itemSelectedEvent = new EventEmitter<TItem | undefined>();

	@ViewChild("searchInput") inputElement?: ElementRef;
	@ViewChild("searchTooltip") searchTooltip?: ElementRef;

	constructor(private elRef: ElementRef) {}

	handleTextChangeFinished: Function | undefined;
	hoveredItem: WritableSignal<number> = signal(-1);
	hintText: WritableSignal<String> = signal(this.placeholder);

	recommendedItems: WritableSignal<TItem[]> = signal([] as TItem[]);

	hasMultipleItems(): boolean {
		return this._items !== undefined && this._items.length > 1;
	}

	updateUIAfterInputValueChange() {
		if (this.inputElement) {
			let search = (this.inputElement.nativeElement as HTMLInputElement).value;

			if (search.trim() == '') {
				this.recommendedItems.set(this._items!);
			} else {
				let filtered = this._items!.filter(e => this.serial!.display(e).toLowerCase().startsWith(search.toLowerCase()));
				this.recommendedItems.set(filtered);
			}
			this.hoveredItem.set(-1);
	
			if (this.recommendedItems().length == 1) {
				let recomText = this.serial!.display(this.recommendedItems()[0]);
				recomText = search + recomText.substring(search.length);
				this.hintText.set(recomText);
			} else {
				this.hintText.set("");
			}
	
			if (search == "") {
				this.hintText.set(this.placeholder);
			}
	
			if (this.handleTextChangeFinished !== undefined) {
				this.handleTextChangeFinished();
				this.handleTextChangeFinished = undefined;
			}	
		}
	}

	handleTextChange(event: Event) {
		this.updateUIAfterInputValueChange();
	}

	hoveredItemChanged() {
		let input = this.inputElement!.nativeElement as HTMLInputElement;
		if(this.hoveredItem() >= 0) {
			this.hintText.set(input.value + this.serial!.display(this.recommendedItems()[this.hoveredItem()]).substring(input.value.length));
			(document.getElementsByClassName("option")[this.hoveredItem()] as HTMLElement).scrollIntoView({ block: "nearest" });
		} else if (input.value.length == 0) {
			this.hintText.set(this.placeholder);
		}
	}

	handleKeyDown(event: KeyboardEvent) {
		let input = (event.target as HTMLInputElement);

		if (event.key == "ArrowDown") {
			if (input.selectionStart == input.value.length) {
				if (this.hoveredItem() < this.recommendedItems().length - 1) {
					this.hoveredItem.set(this.hoveredItem() + 1);
					this.hoveredItemChanged();
				}
				event.preventDefault();
			}
		}
		if (event.key == "ArrowUp") {
			if (this.hoveredItem() != -1) {
				event.preventDefault();
				if (this.hoveredItem() >= 0) {
					this.hoveredItem.set(this.hoveredItem() - 1);
					this.hoveredItemChanged();
				}
			}
		}
		if (event.key == "Enter") {
			if (this.hoveredItem() != -1) {
				let selectedItem = this.recommendedItems()[this.hoveredItem()];
				input.value = this.serial!.display(selectedItem);
				this.updateUIAfterInputValueChange();
				input.blur();
				this.itemSelectedEvent.emit(selectedItem);
			} else if (this.recommendedItems().length == 1) {
				let selectedItem = this.recommendedItems()[0];
				input.value = this.serial!.display(selectedItem);
				this.updateUIAfterInputValueChange();
				input.blur();
				this.itemSelectedEvent.emit(selectedItem);
			}
		}
	}

	getDropdownWrapperFromDOMElement(domElement: HTMLElement) {
		return this.recommendedItems()[parseInt(domElement.id.split("option-")[1])];
	}

	optionClicked(event: Event) {
		let option = (event.target as HTMLElement);
		let input = this.inputElement!.nativeElement as HTMLInputElement;
		input.value = option.textContent!;
		let selectedItem = this.getDropdownWrapperFromDOMElement(option);

		new Promise((res, _) => {
			this.handleTextChangeFinished = res;
		}).then(() => {
			option.blur(); // Remove focus
			this.itemSelectedEvent.emit(selectedItem);
		});
		this.updateUIAfterInputValueChange();
	}

	optionMouseOver(event: Event) {
		let optionId = this.getDropdownWrapperFromDOMElement(event.target as HTMLElement);
		this.hoveredItem.set(this.recommendedItems().indexOf(optionId));
		this.hoveredItemChanged();
	}

	lostFocus(event: Event) {
		let searchString = (this.inputElement!.nativeElement as HTMLInputElement).value;
		let inputIsEmpty = searchString.length == 0;

		if (inputIsEmpty || searchString !== this.hintText()) {
			this.itemSelectedEvent.emit(undefined);
		}

		if (inputIsEmpty) {
			this.hintText.set(this.placeholder);
		} else {
			this.hintText.set("");
		}
	}

	gainedFocus(event: Event) {
		this.updateUIAfterInputValueChange();
	}

	inputScrolled(event: Event) {
		if (this.inputElement && this.searchTooltip) {
			let pixelOffsetX = (this.inputElement.nativeElement as HTMLInputElement).scrollLeft;
			let searchTooltip = this.searchTooltip.nativeElement as HTMLElement;
			searchTooltip.style.marginLeft = String(-pixelOffsetX) + "px";
			console.log(String.apply(-pixelOffsetX) + "px");
		}
	}
}
