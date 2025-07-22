import { Component } from '@angular/core';
import { RouterOutlet } from '@angular/router';
import { ActionbarComponent } from './actionbar/actionbar.component';
import { DeploymentDeveloperNoticeComponent } from './deployment-developer-notice/deployment-developer-notice.component';
import { OfflineIndicatorComponent } from "./offline-indicator/offline-indicator.component";
import { MetaService } from './shared-service/meta.service';
import { PopuplistComponent } from './timed-popups/popuplist/popuplist.component';
import { LoadingoverlayComponent } from "./loadingoverlay/loadingoverlay.component";
import { LoadingoverlayService } from './loadingoverlay/loadingoverlay.service';

@Component({
	selector: 'app-root',
	imports: [RouterOutlet, PopuplistComponent, ActionbarComponent, OfflineIndicatorComponent, DeploymentDeveloperNoticeComponent, LoadingoverlayComponent],
	templateUrl: './app.component.html',
	styleUrl: './app.component.scss'
})

export class AppComponent {
	metaServie: MetaService;
	loadingService: LoadingoverlayService;

	constructor(private meta: MetaService, private loading: LoadingoverlayService) {
		this.metaServie = meta;
		this.loadingService = loading;
	}
}