import { Component } from '@angular/core';
import { RouterOutlet } from '@angular/router';
import { ErrorlistComponent } from './errorlist/errorlist.component';
import { ActionbarComponent } from './actionbar/actionbar.component';
import { OfflineIndicatorComponent } from "./offline-indicator/offline-indicator.component";
import { SworkerUiComponent } from './sworker-ui/sworker-ui.component';
import { CacheUpdatePopupComponent } from "./cache-update-popup/cache-update-popup.component";
import { DeploymentDeveloperNoticeComponent } from './deployment-developer-notice/deployment-developer-notice.component';
import { MetaService } from './shared-service/meta.service';

@Component({
	selector: 'app-root',
	imports: [RouterOutlet, ErrorlistComponent, ActionbarComponent, OfflineIndicatorComponent, SworkerUiComponent, CacheUpdatePopupComponent, DeploymentDeveloperNoticeComponent],
	templateUrl: './app.component.html',
	styleUrl: './app.component.scss'
})

export class AppComponent {
	metaServie: MetaService;

	constructor(private meta: MetaService) {
		this.metaServie = meta;
	}
}