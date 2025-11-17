import { ApiModuleInterfaceB2F, ApiModuleInterfaceF2B } from "./backend_call"
import { UserPermission, UserPermissionList } from "./permission_types"

export type UserInfo = {
    firstName: string
    givenName: string
    thumbnail: string
    accName: string
    permissions: UserPermissionList
    vetproofVeterinaryName: string
}

export function NullUserInfo(): UserInfo {
    return {
        accName: "",
        firstName: "",
        givenName: "",
        permissions: new UserPermissionList([]),
        thumbnail: "",
        vetproofVeterinaryName: ""
    }
};

/* Api endpoints */
export interface ApiInterfaceUserInfoOut extends ApiModuleInterfaceB2F { userinfo: UserInfo, usergrants: UserPermission[] };

export interface ApiInterfaceUsersListInfoOut extends ApiModuleInterfaceB2F { userinfos: UserInfo[] };
