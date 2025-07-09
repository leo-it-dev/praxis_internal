import { Injectable } from '@angular/core';
import { ApiInterfaceGenerateTokenIn, ApiInterfaceGenerateTokenOut, ApiInterfaceRefreshTokenIn, ApiInterfaceRefreshTokenOut, ApiInterfaceRevokeTokenIn } from '../../../../../../api_common/api_auth';
import { ApiInterfaceUserInfoOut } from "../../../../../../api_common/api_ldapquery";
import { ApiInterfaceEmptyIn, ApiInterfaceEmptyOut } from '../../../../../../api_common/backend_call';
import { SessionProviderPlugin } from './session-provider-plugin';
import { SessionProviderService, SessionType } from './session-provider.service';

@Injectable({
    providedIn: 'root'
})
export class SessionOnlineService extends SessionProviderPlugin {
    static AUTH_SERVER = "https://adfs.mittermeier-kraiburg.vet/adfs"
    static CLIENT_ID = "cf1b923f-dccc-4a60-b9dd-927fbbaa8953";
    static CALLBACK_URL = "/login"
    static EXCHANGE_TOKEN_URL = "/module/auth/generateToken"
    static REVOKE_TOKEN_URL = "/module/auth/revokeToken"
    static USERINFO_URL = "/module/ldapquery/userinfo"
    static REFRESH_TOKEN_URL = "/module/auth/refreshToken"

    public getAccessToken(): Promise<string> {
        let storage = SessionProviderService.instance;
        // Our application propably wants to send this access token to the server. In case it is expired, automatically renew it using our stored renewToken().
        return new Promise(async (res, rej) => {
            try {
                const accessTokenIsStillValid = this.jwtHelperService.verifyExpirationClaim(this.jwtHelperService.parseJWTtoken(storage.store._rawAccessToken()!));
                if (accessTokenIsStillValid) {
                    console.log("Access token is valid!");
                    res(storage.store._rawAccessToken()!);
                    return;
                }

                console.log("Access token must be refreshed...");
                await this.forceRefreshToken();
                console.log("Access token was successfully refreshed!");
                res(storage.store._rawAccessToken()!);
            } catch (e) {
                console.log("Error refreshing access token! Terminating session!");
                // Session ended and we couldn't refresh it. Unauthorize the user.
                this.unauthorizeSession("Your session timed out and we could not refresh it!").then(rej).catch(rej);
            }
        });
    };

    private forceRefreshToken(): Promise<void> {
        return new Promise((res, rej) => {
            let storage = SessionProviderService.instance;
            if (!storage.store.idToken || !storage.store.refreshToken) {
                rej("No id token or refresh token found!");
                return;
            }
            this.backend.anonymousBackendCall<ApiInterfaceRefreshTokenIn, ApiInterfaceRefreshTokenOut>(SessionOnlineService.REFRESH_TOKEN_URL,
                { cacheTillOnline: false, refresh_token: storage.store.refreshToken! }).then(json => {
                    storage.store.accessToken = json.access_token;
                    if (json.refresh_token !== undefined) {
                        storage.store.refreshToken = json.refresh_token;
                    }
                    if (json.id_token !== undefined) {
                        let idtoken = json.id_token;
                        storage.store.idToken = idtoken;
                    }
                    storage.storeSessionInStore(SessionType.ONLINE);
                    res();
                }).catch(err => {
                    rej(err);
                });
        });
    }

    authorizeSession() {
        const randomUUID = self.crypto.randomUUID();
        window.location.href = SessionOnlineService.AUTH_SERVER + "/oauth2/authorize?response_type=code&scope=openid&client_id=" + SessionOnlineService.CLIENT_ID + "&state=" + randomUUID + "&redirect_uri=" + window.location.origin + encodeURIComponent(SessionOnlineService.CALLBACK_URL);
    }

    exchangeCodeForToken(code: string, state: string): Promise<void> {
        return new Promise((res, rej) => {
            this.backend.anonymousBackendCall<ApiInterfaceGenerateTokenIn, ApiInterfaceGenerateTokenOut>(SessionOnlineService.EXCHANGE_TOKEN_URL,
                { cacheTillOnline: false, 'code': code, 'state': state }).then(async json => {
                    let storage = SessionProviderService.instance;

                    if (json.id_token && json.access_token && json.refresh_token) {
                        storage.store.idToken = json.id_token;
                        storage.store.accessToken = json.access_token;
                        storage.store.refreshToken = json.refresh_token;
                        await this.resolveUserDetails();
                        storage.storeSessionInStore(SessionType.ONLINE);
                        storage.store.isLoggedIn = true;
                        res();
                    } else {
                        throw new Error("Invalid server response! Keys: " + Object.keys(json));
                    }
                }).catch(err => {
                    rej(err);
                });
        });
    }

    private resolveUserDetails(): Promise<void> {
        return new Promise((res, rej) => {
            this.backend.authorizedBackendCall<ApiInterfaceEmptyIn, ApiInterfaceUserInfoOut>(SessionOnlineService.USERINFO_URL).then(json => {
                let storage = SessionProviderService.instance;
                storage.store.lazyloadUserInfo = json.userinfo;
                res();
            }).catch(err => {
                rej(err);
            });
        });
    }

    unauthorizeSession(reason: string): Promise<void> {
        return new Promise((res, rej) => {
            let storage = SessionProviderService.instance;

            if (!storage.store.isLoggedIn || !storage.store.idToken) {
                setTimeout((() => { storage.redirectClientToLoginPage(reason) }).bind(this), 100);
                rej();
                return;
            }

            this.backend.anonymousBackendCall<ApiInterfaceRevokeTokenIn, ApiInterfaceEmptyOut>(SessionOnlineService.REVOKE_TOKEN_URL,
                { cacheTillOnline: false, id_token: storage.store.idToken }
            ).then(_ => {
                storage.removeUserInformation();
                storage.storeSessionInStore(SessionType.ONLINE);
                setTimeout((() => { storage.redirectClientToLoginPage(reason) }).bind(this), 100);
                res();
            }).catch(err => {
                setTimeout((() => { storage.redirectClientToLoginPage(reason) }).bind(this), 100);
                rej(err);
            });
        });
    }
}
