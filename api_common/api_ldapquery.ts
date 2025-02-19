import { ApiModuleInterface } from "./backend_call"

export type UserInfo = {
    thumbnail: string
}

/* Api endpoints */
export interface ApiInterfaceUserInfo extends ApiModuleInterface { userinfo: UserInfo };