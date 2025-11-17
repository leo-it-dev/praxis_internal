import { Injectable } from '@angular/core';
import { ApiInterfaceUsersListInfoOut, UserInfo } from '../../../../../../api_common/api_ldapquery';
import { ApiInterfaceEmptyIn } from '../../../../../../api_common/backend_call';
import { UserPermission, UserPermissionList } from '../../../../../../api_common/permission_types';
import { BackendService } from '../../api/backend.service';

export type LdapQueryBackendFetch = {
	userlist: UserInfo[]
}

@Injectable({
	providedIn: 'root'
})
export class LdapqueryBackendService extends BackendService {

	API_URL_USERINFO = "/module/ldapquery/users"

	name(): string {
		return "Ldap-Query";
	}

	modulePermission(): UserPermission | undefined {
		return undefined;
	}

	async fetchBackendData(): Promise<LdapQueryBackendFetch> {
		return new Promise<LdapQueryBackendFetch>((res, rej) => {
			let backendDat: LdapQueryBackendFetch = {
				userlist: []
			};

			let loadUserlist = this.authorizedBackendCall<ApiInterfaceEmptyIn, ApiInterfaceUsersListInfoOut>(this.API_URL_USERINFO).then(dat => {
				backendDat.userlist = dat.userinfos;
				for(let user of backendDat.userlist) {
					user.permissions = new UserPermissionList((user.permissions as UserPermissionList).userPermissions)
				}
			}).catch(e => {
				this.getErrorlistService().showErrorMessage("Error receiving list of intranet users: " + e);
			});

			Promise.allSettled([loadUserlist]).then(d => d.find(e => e.status == 'rejected') !== undefined ? rej() : res(backendDat));
		});
	}
}
