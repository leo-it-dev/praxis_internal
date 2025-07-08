import { Injectable, signal, Signal, WritableSignal } from '@angular/core';
import { BackendService } from '../api/backend.service';
import { ApiInterfaceEmptyIn } from '../../../../../api_common/backend_call';
import { ApiInterfaceMetaOut } from '../../../../../api_common/api_meta';

@Injectable({
	providedIn: 'root'
})
export class MetaService {

	isDevelopmentDeployment: WritableSignal<boolean> = signal(true);

	static META_URL = "/module/meta/meta"

	constructor(protected backend: BackendService) {
		this.retrieveBackendMetadata();
	}

	retrieveBackendMetadata(): Promise<void> {
		return new Promise((res, rej) => {
			this.backend.anonymousBackendCall<ApiInterfaceEmptyIn, ApiInterfaceMetaOut>(MetaService.META_URL).then(async json => {
				this.isDevelopmentDeployment.set(json.isDevelopmentDeployment);
			}).catch(err => {
				rej(err);
			});
		});
	}
}
