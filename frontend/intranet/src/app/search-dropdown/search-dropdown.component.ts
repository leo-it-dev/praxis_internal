import { NgFor } from '@angular/common';
import { Component, ElementRef, EventEmitter, Input, Output, QueryList, Signal, signal, ViewChild, ViewChildren, WritableSignal } from '@angular/core';

export type Hint = {
	color: string | undefined;
	text: string | undefined;
};
export const NO_HINT: Hint = {
	color: undefined,
	text: undefined
};

export type RowDisplay = {
	text: string;
	hint: Hint;
}

export interface IStringify<T> {
	display(obj: T): RowDisplay;
}

@Component({
	selector: 'app-search-dropdown',
	imports: [NgFor],
	templateUrl: './search-dropdown.component.html',
	styleUrl: './search-dropdown.component.scss'
})
export class SearchDropdownComponent<TItem> {
	private _items?: Array<TItem>;
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
				this.inputElement.nativeElement.value = this.serial.display(items[0]).text;
			} else {
				this.inputElement.nativeElement.value = "";
			}
			this.updateUIAfterInputValueChange();
		}

		if (items.length == 1) {
			this.itemSelectedEvent.emit(items[0]);
		} else {
			this.itemSelectedEvent.emit(undefined);
		}
	}

	@Input({required: true}) serial: IStringify<TItem> = {display: (e) => 
		({
			text: String.apply(e),
			hint: NO_HINT
		})
	};

	@Output() itemSelectedEvent = new EventEmitter<TItem | undefined>();
	lastItemSelectedEventItem: TItem | undefined = undefined;

	@ViewChild("searchInput") inputElement?: ElementRef;
	@ViewChild("searchTooltip") searchTooltip?: ElementRef;
	@ViewChildren('optionItems') optionItems!: QueryList<ElementRef>;

	constructor(private elRef: ElementRef) {}

	handleTextChangeFinished: Function | undefined;
	hoveredItem: WritableSignal<number> = signal(-1);
	hintText: WritableSignal<String> = signal(this.placeholder);

	recommendedItems: WritableSignal<Array<TItem>> = signal([] as TItem[]);

	emitEvent(item: TItem | undefined) {
		if (this.lastItemSelectedEventItem !== item || item == undefined) {
			this.lastItemSelectedEventItem = item;
			this.itemSelectedEvent.emit(item);
		}
	}

	hasMultipleItems(): boolean {
		return this._items !== undefined && this._items.length > 1;
	}

	updateUIAfterInputValueChange() {
		if (this.inputElement) {
			let search = (this.inputElement.nativeElement as HTMLInputElement).value;

			if (search.trim() == '') {
				this.recommendedItems.set(this._items!);
			} else {
				let filtered = this._items!.filter(e => this.serial!.display(e).text.toLowerCase().startsWith(search.toLowerCase()));
				this.recommendedItems.set(filtered);
			}
			this.hoveredItem.set(-1);
	
			if (this.recommendedItems().length == 1) {
				let recomText = this.serial!.display(this.recommendedItems()[0]).text;
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

	hoveredItemChanged(autoScroll: boolean) {
		let input = this.inputElement!.nativeElement as HTMLInputElement;
		if(this.hoveredItem() >= 0) {
			this.hintText.set(input.value + this.serial!.display(this.recommendedItems()[this.hoveredItem()]).text.substring(input.value.length));
			if (autoScroll) {
				(this.optionItems.get(this.hoveredItem())?.nativeElement as HTMLElement).scrollIntoView({block: "nearest"});
			}
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
					this.hoveredItemChanged(true);
				}
				event.preventDefault();
			}
		}
		if (event.key == "ArrowUp") {
			if (this.hoveredItem() != -1) {
				event.preventDefault();
				if (this.hoveredItem() >= 0) {
					this.hoveredItem.set(this.hoveredItem() - 1);
					this.hoveredItemChanged(true);
				}
			}
		}
		if (event.key == "Enter") {
			let selectedItem = undefined;
			if (this.hoveredItem() != -1) {
				selectedItem = this.recommendedItems()[this.hoveredItem()];
			} else if (this.recommendedItems().length == 1) {
				selectedItem = this.recommendedItems()[0];
			}
			if (selectedItem) {
				this.selectItemExt(selectedItem);
			}
		}
		if (event.key == "PageUp") {
			let selected = this.hoveredItem() == -1 ? 0 : this.hoveredItem();
			let optionDOM = this.optionItems.get(selected)?.nativeElement as HTMLElement;
			optionDOM.parentElement!.scrollTop -= optionDOM.parentElement!.getBoundingClientRect().height;
			
			while(selected > 0) {
				let optionDOM = this.optionItems.get(selected)?.nativeElement as HTMLElement;
				if (optionDOM.getBoundingClientRect().y - optionDOM.parentElement!.getBoundingClientRect().y <= 0) {
					this.hoveredItem.set(selected+1);
					this.hoveredItemChanged(true);
					break;
				}
				selected--;
			}
		}
		if (event.key == "PageDown") {
			let selected = this.hoveredItem() == -1 ? 0 : this.hoveredItem();
			let optionDOM = this.optionItems.get(selected)?.nativeElement as HTMLElement;
			optionDOM.parentElement!.scrollTop += optionDOM.parentElement!.getBoundingClientRect().height;
			
			while(selected < this.optionItems.length) {
				let optionDOM = this.optionItems.get(selected)?.nativeElement as HTMLElement;
				if (optionDOM.getBoundingClientRect().y - optionDOM.parentElement!.getBoundingClientRect().y + optionDOM.getBoundingClientRect().height >= optionDOM.parentElement!.getBoundingClientRect().height) {
					this.hoveredItem.set(selected-1);
					this.hoveredItemChanged(true);
					break;
				}
				selected++;
			}
		}
		if (event.key == "Home") {
			this.hoveredItem.set(0);
			this.hoveredItemChanged(true);
		}
		if (event.key == "End") {
			this.hoveredItem.set(this.optionItems.length - 1);
			this.hoveredItemChanged(true);
		}
	}

	getDropdownWrapperFromDOMElement(domElement: HTMLElement) {
		return this.recommendedItems()[parseInt(domElement.getAttribute("data-id")!)];
	}

	optionClicked(event: Event) {
		let option = (event.target as HTMLElement);
		let input = this.inputElement!.nativeElement as HTMLInputElement;
		input.value = option.getElementsByClassName("dropdownRowText")[0].textContent || "";
		let selectedItem = this.getDropdownWrapperFromDOMElement(option);

		new Promise((res, _) => {
			this.handleTextChangeFinished = res;
		}).then(() => {
			option.blur(); // Remove focus
			this.emitEvent(selectedItem);
		});
		this.updateUIAfterInputValueChange();
	}

	selectItemExt(item?: TItem) {
		if (this.inputElement) {
			const input = (this.inputElement.nativeElement as HTMLInputElement);
			if (item) {
				if (this._items && this._items.includes(item)) {
					input.value = this.serial!.display(item).text;
					this.updateUIAfterInputValueChange();
					//input.blur();
					this.emitEvent(item);
				}
			} else {
				input.value = "";
				this.updateUIAfterInputValueChange();
				//input.blur();
				this.emitEvent(undefined);
			}
		}
	}

	optionMouseOver(event: Event) {
		let optionId = this.getDropdownWrapperFromDOMElement(event.target as HTMLElement);
		this.hoveredItem.set(this.recommendedItems().indexOf(optionId));
		this.hoveredItemChanged(false);
	}

	lostFocus(_: Event) {
		if (this.recommendedItems().length == 1) {
			let item = this.recommendedItems()[0];
			this.inputElement!.nativeElement.value = this.serial.display(item).text;
			this.emitEvent(item);
		} else if (this.hoveredItem() !== -1) {
			let item = this.recommendedItems()[this.hoveredItem()];
			this.inputElement!.nativeElement.value = this.serial.display(item).text;
			this.emitEvent(item);
		}
		
		let searchString = (this.inputElement!.nativeElement as HTMLInputElement).value;
		let inputIsEmpty = searchString.length == 0;
		if (inputIsEmpty || searchString !== this.hintText()) {
			this.emitEvent(undefined);
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

	performQuickDelete(event: Event) {
		event.preventDefault();
		if (this.inputElement) {
			this.inputElement.nativeElement.value = "";
			this.updateUIAfterInputValueChange();
			this.inputElement.nativeElement.focus();
		}
	}
}
