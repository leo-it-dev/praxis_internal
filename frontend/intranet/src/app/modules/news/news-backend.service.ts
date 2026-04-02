import { Injectable } from '@angular/core';
import { BackendService } from '../../api/backend.service';
import { UserPermission } from '../../../../../../api_common/permission_types';
import { ApiInterfaceEmptyIn } from '../../../../../../api_common/backend_call';
import { ApiInterfaceNewsOut, News } from '../../../../../../api_common/api_news';

export type NewsBackendFetch = {
	newsList: News[];
}

@Injectable({
	providedIn: 'root'
})
export class NewsBackendService extends BackendService {

	API_URL_NEWS = "/module/news/news"
	API_URL_POST_NEWS = "/module/news/postnews"

	name(): string {
		return "Praxis-News";
	}

	modulePermission(): UserPermission | undefined {
		return UserPermission.NEWS;
	}

	async fetchBackendData(): Promise<NewsBackendFetch> {
		return new Promise<NewsBackendFetch>((res, rej) => {
			let newsList: NewsBackendFetch = { newsList: [] };

			let news = this.authorizedBackendCall<ApiInterfaceEmptyIn, ApiInterfaceNewsOut>(this.API_URL_NEWS).then(dat => {
				newsList.newsList = dat.simpleNews;
				newsList.newsList = newsList.newsList.map(d => {
					return {
						text: d.text,
						created: new Date(d.created),
						creator: d.creator,
						id: d.id,
						creatorSID: d.creatorSID
					}
				})
			}).catch(e => {
				this.getErrorlistService().showErrorMessage("Error receiving list of intranet users: " + e);
			});

			Promise.allSettled([news]).then(d => d.find(e => e.status == 'rejected') !== undefined ? rej() : res(newsList));
		});
	}
}
