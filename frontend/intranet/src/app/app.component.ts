import { Component } from '@angular/core';
import { RouterOutlet } from '@angular/router';
import { ErrorlistComponent } from './errorlist/errorlist.component';
import { ActionbarComponent } from './actionbar/actionbar.component';
import { OfflineIndicatorComponent } from "./offline-indicator/offline-indicator.component";
import { SworkerUiComponent } from './sworker-ui/sworker-ui.component';

@Component({
  selector: 'app-root',
  imports: [RouterOutlet, ErrorlistComponent, ActionbarComponent, OfflineIndicatorComponent, SworkerUiComponent],
  templateUrl: './app.component.html',
  styleUrl: './app.component.scss'
})
export class AppComponent {}