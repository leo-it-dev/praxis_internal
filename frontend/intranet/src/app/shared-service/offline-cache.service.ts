import { Injectable } from '@angular/core';

@Injectable({
	providedIn: 'root'
})
export class OfflineCacheService {

	constructor() {}

	getFromAngularSWCache(requestUrl: string): Promise<Response> {
		return new Promise(async (res, rej) => {
			const cacheNames = await caches.keys();

			const targetCacheNames = cacheNames.filter(name =>
				name.startsWith('ngsw:') && (name.includes(':data'))
			);
	
			for (const cacheName of targetCacheNames) {
				const cache = await caches.open(cacheName);
				const match = await cache.match(requestUrl);
				if (match) {
					try {
						res(match);
						return;
					} catch (e) {
						console.error(`Could not parse response for ${requestUrl} from ${cacheName}`);
					}
				}
			}
	
			rej(); // Not found in any Angular-managed caches
		});
	}
}
