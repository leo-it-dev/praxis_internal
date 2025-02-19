import { ApiModuleInterface } from "../api_common/backend_call"

/* Api endpoint generateToken */
export interface ApiInterfaceGenerateToken extends ApiModuleInterface { id_token: string; access_token: string; refresh_token: string }
export interface ApiInterfaceRevokeToken extends ApiModuleInterface {};
export interface ApiInterfaceRefreshToken extends ApiModuleInterface {access_token: string; refresh_token: string; id_token: string};