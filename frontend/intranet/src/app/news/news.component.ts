import { Component, ElementRef, inject, signal, ViewChild, WritableSignal } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { ApiInterfaceDropNewsIn, ApiInterfacePostNewsIn, News } from '../../../../../api_common/api_news';
import { ApiInterfaceEmptyOut } from '../../../../../api_common/backend_call';
import { UserPermission } from '../../../../../api_common/permission_types';
import { ModuleComponent } from '../module/module/module.component';
import { NewsBackendFetch, NewsBackendService } from '../modules/news/news-backend.service';
import { ErrorlistService } from '../timed-popups/popuplist/errorlist.service';
import { TrashSvgComponent } from '../trash-svg/trash-svg.component';

@Component({
	selector: 'app-news',
	imports: [ReactiveFormsModule, TrashSvgComponent],
	templateUrl: './news.component.html',
	styleUrl: './news.component.scss'
})
export class NewsComponent extends ModuleComponent {

	static API_URL_POST_NEWS = "/module/news/postnews";
	static API_URL_DROP_NEWS = "/module/news/dropnews";

	permissionToPostNews: WritableSignal<boolean> = signal(false);
	newsList: WritableSignal<NewsBackendFetch> = signal({ newsList: [] });
	@ViewChild("postText")
	postText!: ElementRef<HTMLInputElement>;

	private formBuilder = inject(FormBuilder);
	postFormGroup = this.formBuilder.group({
		message: [{ value: '', disabled: !this.getSessionService().isOnlineSession() }, [Validators.required]],
	});

	override afterViewInit(): void {
		this.permissionToPostNews.set(this.getSessionService().store.lazyloadUserInfo?.permissions.userHasPermission(UserPermission.POST_NEWS) || false);
	}

	refreshData() {
		this.getBackendService().fetchBackendData().then(dat => {
			let backendDat = dat as NewsBackendFetch;
			this.newsList.set(backendDat);
		});
	}

	constructor(
		private error: ErrorlistService
	) {
		super(NewsBackendService);
		this.refreshData();
	}

	formatTimestamp(date: Date) {
		return new Intl.DateTimeFormat("de-DE", {
			dateStyle: "full",
			timeStyle: "short",
			timeZone: "Europe/Berlin",
		}).format(date);
	}

	postNews(event: Event) {
		event.preventDefault();
		this.postFormGroup.updateValueAndValidity();
		if (this.postFormGroup.valid) {
			this.getBackendService().authorizedBackendCall<ApiInterfacePostNewsIn, ApiInterfaceEmptyOut>(NewsComponent.API_URL_POST_NEWS, {
				cacheTillOnline: false,
				message: this.postText.nativeElement.value
			}).then(_ => {
				this.postText.nativeElement.value = "";
				this.error.showErrorMessage("Successfully posted news!");
				this.refreshData();
			}).catch(err => {
				this.error.showErrorMessage("Error posting news: " + new String(err));
				this.refreshData();
			});
		}
	}

	deletePost(news: News) {
		this.getBackendService().authorizedBackendCall<ApiInterfaceDropNewsIn, ApiInterfaceEmptyOut>(NewsComponent.API_URL_DROP_NEWS, {
			cacheTillOnline: false,
			newsID: news.id
		}).then(_ => {
			this.error.showErrorMessage("Successfully deleted news entry!");
			this.refreshData();
		}).catch(err => {
			this.error.showErrorMessage("Error deleting news entry: " + new String(err));
			this.refreshData();
		});
	}
}