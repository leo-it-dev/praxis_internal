import { Component, computed, ElementRef, Signal, signal, ViewChild, WritableSignal } from '@angular/core';
import { ControlValueAccessor, NgControl } from '@angular/forms';
import { BlockingoverlayComponent, OverlayButton, OverlayButtonDesign } from '../blockingoverlay/blockingoverlay.component';
import { LoggedOutSvgComponent } from '../logged-out-svg/logged-out-svg.component';
import { generateSquareThumbnailBase64 } from '../utilities/image-rescale';
import { toSignal } from '@angular/core/rxjs-interop';
import { EMPTY } from 'rxjs';

@Component({
	selector: 'app-image-picker',
	imports: [LoggedOutSvgComponent, BlockingoverlayComponent],
	templateUrl: './image-picker.component.html',
	styleUrl: './image-picker.component.scss'
})
export class ImagePickerComponent implements ControlValueAccessor {

	public overlayShown = false;
	public overlayButtons: WritableSignal<OverlayButton[]> = signal([]);

	public imageLoaded: WritableSignal<string> = signal("");

	private setNewImageButton = {
		design: OverlayButtonDesign.PRIMARY_COLORED,
		id: 1,
		text: "Neues Bild hinterlegen"
	};

	private exitButton = {
		design: OverlayButtonDesign.BASIC_BLANK,
		id: 3,
		text: "Abbrechen"
	};
	private removeImageButton = {
		design: OverlayButtonDesign.BASIC_BLANK,
		id: 2,
		text: "Bild entfernen"
	};

	@ViewChild('imageSelector') imageSelector!: ElementRef<HTMLInputElement>;
	changeEvent: (newValue: string) => void = (_) => {};

	constructor(protected controlDir: NgControl) {
		controlDir.valueAccessor = this;
	}

	writeValue(obj: any): void {
		this.imageLoaded.set(obj);
	}

	registerOnChange(fn: any): void {
		this.changeEvent = fn;
	}

	registerOnTouched(fn: any): void {}

	setDisabledState(isDisabled: boolean): void {}

	imageSelected() {
		let files = this.imageSelector?.nativeElement.files;
		if (files && files.length > 0) {
			let blob = URL.createObjectURL(files[0]);
			let image = new Image();
			image.onload = () => {
				let thumbnail = generateSquareThumbnailBase64(image, 500);
				this.changeEvent(thumbnail);
				this.imageLoaded.set(thumbnail);
			}
			image.src = blob;
		} else {
			this.changeEvent("");
			this.imageLoaded.set("");
		}
	}

	removeImage() {
		this.changeEvent("");
		this.imageLoaded.set("");
	}

	openSelector() {
		if (this.controlDir.control?.enabled) {
			this.imageSelector.nativeElement.click();
		}
	}

	showOverlay() {
		if (this.controlDir.enabled)
		{
			if (this.controlDir.control?.value) {
				this.overlayButtons.set([this.setNewImageButton, this.removeImageButton, this.exitButton]);
			} else {
				this.overlayButtons.set([this.setNewImageButton, this.exitButton]);
			}
			this.overlayShown = true;
		}
	}

	processOverlayButton(button: OverlayButton) {
		if (button.id == 1) {
			this.openSelector();
		}
		if (button.id == 2) {
			this.removeImage();
		}
		this.overlayShown = false;
	}
}
