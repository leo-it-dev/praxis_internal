import { Component } from '@angular/core';
import { RouterOutlet } from '@angular/router';
import { ActionbarComponent } from './actionbar/actionbar.component';
import { DeploymentDeveloperNoticeComponent } from './deployment-developer-notice/deployment-developer-notice.component';
import { OfflineIndicatorComponent } from "./offline-indicator/offline-indicator.component";
import { MetaService } from './shared-service/meta.service';
import { PopuplistComponent } from './timed-popups/popuplist/popuplist.component';

@Component({
	selector: 'app-root',
	imports: [RouterOutlet, PopuplistComponent, ActionbarComponent, OfflineIndicatorComponent, DeploymentDeveloperNoticeComponent],
	templateUrl: './app.component.html',
	styleUrl: './app.component.scss'
})

export class AppComponent {
	metaServie: MetaService;

	constructor(private meta: MetaService) {
		this.metaServie = meta;
	}
}