import { ApiModuleInterfaceB2F, ApiModuleInterfaceF2B } from "./backend_call"

export enum JwtErrorType {
    OTHER = 0,
    EXPIRED = 1
}

export type JwtError = {
    reason: string;
    error: JwtErrorType;
}

/* Api endpoint generateToken */

export interface ApiInterfaceGenerateTokenIn extends ApiModuleInterfaceF2B { code: string, state: string }
export interface ApiInterfaceGenerateTokenOut extends ApiModuleInterfaceB2F { id_token: string; access_token: string; refresh_token: string }

export interface ApiInterfaceRevokeTokenIn extends ApiModuleInterfaceF2B { id_token: string };

export interface ApiInterfaceRefreshTokenIn extends ApiModuleInterfaceF2B { refresh_token: string; id_token: string };
export interface ApiInterfaceRefreshTokenOut extends ApiModuleInterfaceB2F { access_token: string; refresh_token: string; id_token: string };
