import { ApiModuleInterfaceB2F } from "./backend_call"
import { UserPermission } from "./permission_types"

export type UserInfo = {
    thumbnail: string,
    vetproofVeterinaryName: string,
    accName: string
}

/* Api endpoints */
export interface ApiInterfaceUserInfoOut extends ApiModuleInterfaceB2F { userinfo: UserInfo, usergrants: UserPermission[] };