import { ApiModuleInterfaceB2F } from "./backend_call"

export type UserInfo = {
    thumbnail: string
}

/* Api endpoints */
export interface ApiInterfaceUserInfoOut extends ApiModuleInterfaceB2F { userinfo: UserInfo };
