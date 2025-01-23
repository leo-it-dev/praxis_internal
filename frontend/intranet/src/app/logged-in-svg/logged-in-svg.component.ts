import { Component, ElementRef } from '@angular/core';

@Component({
  standalone: true,
  selector: 'logged-in-svg',
  templateUrl: '../../../public/images/loggedin.svg',
  styles: [".gradientStop1 {stop-color: var(--action-button-gradient-left);}", 
           ".gradientStop2 {stop-color: var(--action-button-gradient-right);}"]
})
export class LoggedInSvgComponent {
  constructor (private elementRef: ElementRef) {
    if (elementRef.nativeElement.hasAttribute('col')) {
      const col = elementRef.nativeElement.getAttribute('col');
      elementRef.nativeElement.style.setProperty('--action-button-gradient-left', col);
      elementRef.nativeElement.style.setProperty('--action-button-gradient-right', col);
    }
  }
}