import { CommonModule, NgFor } from '@angular/common';
import { AfterViewInit, ChangeDetectorRef, Component, computed, ElementRef, EventEmitter, Input, Output, QueryList, signal, ViewChild, ViewChildren, WritableSignal } from '@angular/core';
import { ControlValueAccessor, FormControl, NgControl, ReactiveFormsModule } from '@angular/forms';
import { HintComponent } from "../hint-ok/hint.component";

export type Hint = {
	color: string;
	text: string;
};
export const NO_HINT: Hint = {
	color: 'black',
	text: ''
};

export type RowDisplay = {
	text: string;
	hint: Hint;
}

export interface IStringify<T> {
	display(obj: T): RowDisplay;
}

export interface IItemDisable<T> {
	isItemDisabled(obj: T): boolean;
}


@Component({
	selector: 'app-search-dropdown',
	imports: [NgFor, CommonModule, ReactiveFormsModule, HintComponent],
	templateUrl: './search-dropdown.component.html',
	styleUrl: './search-dropdown.component.scss'
})
export class SearchDropdownComponent<TItem> implements AfterViewInit, ControlValueAccessor {
	private _items?: Array<TItem>;
	private _placeholder: string = "<unset>";
	private _preventNextSelectEventEmit = false;

	private _selectItemAfterInit: TItem|undefined = undefined;

	handleTextChangeFinished: Function | undefined;
	hoveredItem: WritableSignal<number> = signal(-1);
	hintText: WritableSignal<String> = signal(this.placeholder);

	recommendedItems: WritableSignal<Array<TItem>> = signal([] as TItem[]);

	currentItemRowDisplay = computed(() => this.lastItemSelectedEventItem() ? this.serial.display(this.lastItemSelectedEventItem()!) : {text: '', hint: {color: '', text: ''}});

	constructor(private controlDir: NgControl,
		private changeDetRef: ChangeDetectorRef
	) {
		this.controlDir.valueAccessor = this;
	}

	@Input({required: true}) 
	get placeholder() {
		return this._placeholder;
	}

	set placeholder(placeholder: string) {
		this._placeholder = placeholder;
		this.hintText.set(placeholder);
	}

	preventNextSelectEventEmit() {
		this._preventNextSelectEventEmit = true;
	}

	@Input({required: true}) 
	set items(items: TItem[]) {
		if (!items) {
			items = [];
		}

		this._items = items;
		this.recommendedItems.set(this._items);

		let enabledItems = items.filter(i => !this.itemDisabled.isItemDisabled(i));

		let selectItem = enabledItems.length == 1 ? enabledItems[0] : undefined;
		if (this.inputElement) {
			let value = selectItem ? this.serial.display(selectItem).text : "";
			this.inputElement.nativeElement.value = value;
			this.updateUIAfterInputValueChange();
		} else {
			this._selectItemAfterInit = selectItem;
		}
		this.updateEnableFlag();

		if (items.length == 1) {
			this.sendEvent(items[0]);
			this.forceInvalidate(false);
		} else {
			this.sendEvent(undefined);
			this.forceInvalidate(true);
		}
	}

	@Input({required: true}) serial: IStringify<TItem> = {display: (e) => 
		({
			text: String.apply(e),
			hint: NO_HINT
		})
	};

	@Input({required:false}) itemDisabled: IItemDisable<TItem> = {isItemDisabled: (e) => {
		return false;
	}};

	@Output() itemSelectedEvent = new EventEmitter<TItem | undefined>();
	lastItemSelectedEventItem: WritableSignal<TItem | undefined> = signal(undefined);

	@ViewChild("searchInput") inputElement?: ElementRef;
	@ViewChild("searchTooltip") searchTooltip?: ElementRef;
	@ViewChildren('optionItems') optionItems!: QueryList<ElementRef>;

	updateEnableFlag() {
		if (this.control) {
			if (this.filterItemsNotDisabled().length > 1) {
				this.control.enable();
			} else {
				this.control.disable();
			}
		}
	}

	forceInvalidate(invalid: boolean) {
		if (this.control) {
			setTimeout(() => {
				if (invalid) {
					this.control.setErrors({'incorrect': true});
				} else {
					this.control.setErrors(null);
				}
			}, 1);
		}
	}

	ngAfterViewInit(): void {
		this.updateEnableFlag();
		if (this._selectItemAfterInit !== undefined) {
			this.selectItemExt(this._selectItemAfterInit as TItem);
			this._selectItemAfterInit = undefined;
		} else {
			this.forceInvalidate(true);
		}
	}

	sendEvent(item: TItem | undefined) {
		if (!this._preventNextSelectEventEmit) {
			this.itemSelectedEvent.emit(item);
		} else {
			this._preventNextSelectEventEmit = false;
		}
		if (this.onChangeValidationCallback) {
			this.onChangeValidationCallback(item);
		}
	}

	emitEvent(item: TItem | undefined) {
		if (this.lastItemSelectedEventItem() !== item || item == undefined) {
			this.lastItemSelectedEventItem.set(item);
			this.sendEvent(item);
		}
		this.forceInvalidate(item === undefined);
	}

	filterItemsNotDisabled(): TItem[] {
		return (this._items || []).filter(i => !this.itemDisabled.isItemDisabled(i));
	}
	filterRecommendedItemsNotDisabled(): TItem[] {
		return (this.recommendedItems() || []).filter(i => !this.itemDisabled.isItemDisabled(i));
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

			if (this.recommendedItems().length == 1 && !this.itemDisabled.isItemDisabled(this.recommendedItems()[0])) {
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
		this.forceInvalidate(this.lastItemSelectedEventItem() === undefined);
	}

	hoveredItemChanged(autoScroll: boolean) {
		let input = this.inputElement!.nativeElement as HTMLInputElement;
		let hoveredItem = this.hoveredItem() >= 0 && !this.itemDisabled.isItemDisabled(this.recommendedItems()[this.hoveredItem()]) ? this.recommendedItems()[this.hoveredItem()] : undefined;
		
		if(hoveredItem) {
			this.hintText.set(input.value + this.serial!.display(hoveredItem).text.substring(input.value.length));
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
				let nextEnabledItem = this.recommendedItems().slice(this.hoveredItem() + 1).find(e => !this.itemDisabled.isItemDisabled(e));
				if (nextEnabledItem) {
					let nextEnabledItemIdx = this.recommendedItems().indexOf(nextEnabledItem);
					this.hoveredItem.set(nextEnabledItemIdx);
					this.hoveredItemChanged(true);
				}
			}
			event.preventDefault();
		}
		if (event.key == "ArrowUp") {
			if (this.hoveredItem() != -1) {
				if (this.hoveredItem() >= 0) {
					let prevEnabledItem = this.recommendedItems().slice(0, this.hoveredItem()).reverse().find(e => !this.itemDisabled.isItemDisabled(e));
					if (prevEnabledItem) {
						let prevEnabledItemIdx = this.recommendedItems().indexOf(prevEnabledItem);
						this.hoveredItem.set(prevEnabledItemIdx);
						this.hoveredItemChanged(true);
					}
				}
			}
			event.preventDefault();
		}
		if (event.key == "Enter") {
			let selectedItem = undefined;
			if (this.hoveredItem() != -1) {
				selectedItem = this.recommendedItems()[this.hoveredItem()];
			} else if (this.recommendedItems().length == 1 && !this.itemDisabled.isItemDisabled(this.recommendedItems()[0])) {
				selectedItem = this.recommendedItems()[0];
			}
			if (selectedItem) {
				this.selectItemExt(selectedItem);
			}
			event.preventDefault();
		}
		if (event.key == "PageUp") {
			let enabledItems = this.filterRecommendedItemsNotDisabled();
			if (enabledItems.length > 0) {
				let firstEnabledItemIdx = this.recommendedItems().indexOf(enabledItems[0]);
				let selected = this.hoveredItem() == -1 ? firstEnabledItemIdx : this.hoveredItem();
				let scrollContainerDOM = (this.optionItems.get(0)?.nativeElement as HTMLElement).parentElement as HTMLElement;
				scrollContainerDOM.scrollTop -= scrollContainerDOM.getBoundingClientRect().height;

				while(selected > 0) {
					let optionDOM = this.optionItems.get(selected)?.nativeElement as HTMLElement;
					let optionDomTop = optionDOM.getBoundingClientRect().y;
					let optionItem = this.recommendedItems()[selected];
					let optionIsDisabled = this.itemDisabled.isItemDisabled(optionItem);
					if (!optionIsDisabled && (optionDomTop - optionDOM.parentElement!.getBoundingClientRect().y <= 0)) {
						this.hoveredItem.set(selected);
						optionDOM.scrollIntoView({
							behavior: 'instant',
							block: 'start'
						});
						this.hoveredItemChanged(true);
						break;
					}
					selected--;
				}
			}
			event.preventDefault();
		}
		if (event.key == "PageDown") {
			let enabledItems = this.filterRecommendedItemsNotDisabled();
			if (enabledItems.length > 0) {
				let lastEnabledItemIdx = this.recommendedItems().indexOf(enabledItems[0]);
				let selected = this.hoveredItem() == -1 ? lastEnabledItemIdx : this.hoveredItem();
				let scrollContainerDOM = (this.optionItems.get(0)?.nativeElement as HTMLElement).parentElement as HTMLElement;
				scrollContainerDOM.scrollTop += scrollContainerDOM.getBoundingClientRect().height;

				while(selected < this.optionItems.length) {
					let optionDOM = this.optionItems.get(selected)?.nativeElement as HTMLElement;
					let optionDomTop = optionDOM.getBoundingClientRect().y;
					let optionItem = this.recommendedItems()[selected];
					let optionIsDisabled = this.itemDisabled.isItemDisabled(optionItem);
					if (!optionIsDisabled && (optionDomTop - optionDOM.parentElement!.getBoundingClientRect().y + optionDOM.getBoundingClientRect().height >= scrollContainerDOM.getBoundingClientRect().height)) {
						this.hoveredItem.set(selected);
						optionDOM.scrollIntoView({
							behavior: 'instant',
							block: 'end'
						});
						this.hoveredItemChanged(true);
						break;
					}
					selected++;
				}
			}
			event.preventDefault();
		}
		if (event.key == "Home") {
			let enabledItems = this.filterRecommendedItemsNotDisabled();
			if (enabledItems.length > 0) {
				let firstEnabledItem = this.recommendedItems().indexOf(enabledItems[0]);
				this.hoveredItem.set(firstEnabledItem);
				this.hoveredItemChanged(true);
			}
			event.preventDefault();
		}
		if (event.key == "End") {
			let enabledItems = this.filterRecommendedItemsNotDisabled();
			if (enabledItems.length > 0) {
				let lastEnabledItem = this.recommendedItems().indexOf(enabledItems[enabledItems.length - 1]);
				this.hoveredItem.set(lastEnabledItem);
				this.hoveredItemChanged(true);
			}
			event.preventDefault();
		}
	}

	getDropdownWrapperFromDOMElement(domElement: HTMLElement) {
		return this.recommendedItems()[parseInt(domElement.getAttribute("data-id")!)];
	}

	optionClicked(event: Event) {
		let option = (event.target as HTMLElement);
		let input = this.inputElement!.nativeElement as HTMLInputElement;
		let value = option.getElementsByClassName("dropdownRowText")[0].textContent || "";
		let selectedItem = this.getDropdownWrapperFromDOMElement(option);

		if (!this.itemDisabled.isItemDisabled(selectedItem)) {
			input.value = value;
			new Promise((res, _) => {
				this.handleTextChangeFinished = res;
			}).then(() => {
				option.blur(); // Remove focus
				this.emitEvent(selectedItem);
			});
			this.updateUIAfterInputValueChange();
		}
	}

	selectItemExt(item?: TItem) {
		if (this.inputElement) {
			const input = (this.inputElement.nativeElement as HTMLInputElement);
			if (item && !this.itemDisabled.isItemDisabled(item) && this._items && this._items.includes(item)) {
				input.value = this.serial!.display(item).text;
				this.updateUIAfterInputValueChange();
				//input.blur();
				this.emitEvent(item);
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
		if (!this.itemDisabled.isItemDisabled(optionId)) {
			this.hoveredItem.set(this.recommendedItems().indexOf(optionId));
			this.hoveredItemChanged(false);
		}
	}

	reevaluateAndEmit() {
		let searchString = (this.inputElement!.nativeElement as HTMLInputElement).value;
		let inputIsEmpty = searchString.length == 0;
		let equalItem = this.recommendedItems().find(i => this.serial.display(i).text.toLowerCase() === searchString.toLowerCase() && !this.itemDisabled.isItemDisabled(i));
		let enabledItems = this.filterRecommendedItemsNotDisabled();

		if (enabledItems.length == 1) {
			let item = enabledItems[0];
			let value = this.serial.display(item).text;
			this.inputElement!.nativeElement.value = value;
			this.emitEvent(item);
		}
		else if (equalItem != undefined) {
			let value = this.serial.display(equalItem).text;
			this.inputElement!.nativeElement.value = value;
			this.emitEvent(equalItem);
		} else if (inputIsEmpty || searchString !== this.hintText()) {
			this.emitEvent(undefined);
		}

		/* else if (this.hoveredItem() !== -1) {
			let item = this.recommendedItems()[this.hoveredItem()];
			this.inputElement!.nativeElement.value = this.serial.display(item).text;
			this.emitEvent(item);
		}*/ // Dont! This also fires when hovering an item with the mouse and the text field is empty!
		
		if (inputIsEmpty) {
			this.hintText.set(this.placeholder);
		} else {
			this.hintText.set("");
		}
	}

	lostFocus(_: Event) {
		this.reevaluateAndEmit();
	}

	gainedFocus(event: Event) {
		this.updateUIAfterInputValueChange();
		this.forceInvalidate(this.lastItemSelectedEventItem() === undefined);
	}

	inputScrolled(event: Event) {
		if (this.inputElement && this.searchTooltip) {
			let pixelOffsetX = (this.inputElement.nativeElement as HTMLInputElement).scrollLeft;
			let searchTooltip = this.searchTooltip.nativeElement as HTMLElement;
			searchTooltip.style.marginLeft = String(-pixelOffsetX) + "px";
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


	/* =========== Value Validation =========== */
	private onChangeValidationCallback?: Function = undefined;

	writeValue(obj: any): void {
		if (this.inputElement) {
			this.selectItemExt(obj as TItem);
		} else {
			let enabledItems = this.filterItemsNotDisabled();
			if (enabledItems.length == 1 && (obj === undefined || obj === null)) {
				// If only one item can be selected, the user must choose this one item, therefore we don't allow for deleting the content of our field.
				return;
			}
			this._selectItemAfterInit = obj as TItem;
		}
	}
	registerOnChange(fn: any): void {
		this.onChangeValidationCallback = fn;
	}
	registerOnTouched(fn: any): void {}

	get control(): FormControl {
		return this.controlDir.control as FormControl;
	}
}
