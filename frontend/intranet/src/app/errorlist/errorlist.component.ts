import { Component } from '@angular/core';
import { ErrormessageComponent } from '../errormessage/errormessage.component';
import { KeyValuePipe, NgFor } from '@angular/common';
import { ErrorlistService } from './errorlist.service';

@Component({
  selector: 'app-errorlist',
  imports: [ErrormessageComponent, NgFor, KeyValuePipe],
  templateUrl: './errorlist.component.html',
  styleUrl: './errorlist.component.scss'
})
export class ErrorlistComponent {

  constructor(private errorlistService: ErrorlistService) {}

  trackByFn(index: number, item: any) {
    return item.key;
  }

  removeItem(event: ErrormessageComponent) {
    this.errorlistService.removeErrorMessage(event.id);
  }

  getErrorlist() {
    return this.errorlistService.errors;
  }
}
