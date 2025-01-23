import { Component } from '@angular/core';
import { RouterOutlet } from '@angular/router';
import { ErrorlistComponent } from './errorlist/errorlist.component';
import { ActionbarComponent } from './actionbar/actionbar.component';

@Component({
  selector: 'app-root',
  imports: [RouterOutlet, ErrorlistComponent, ActionbarComponent],
  templateUrl: './app.component.html',
  styleUrl: './app.component.scss'
})
export class AppComponent {}