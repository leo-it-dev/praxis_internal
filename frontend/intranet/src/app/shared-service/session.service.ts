import { Injectable, signal, WritableSignal } from '@angular/core';
import { JwtHelperService } from "./jwt-helper.service";
import { ErrorlistService } from '../errorlist/errorlist.service';
import { BackendService } from "../api/backend.service"
import { ApiInterfaceGenerateToken, ApiInterfaceRefreshToken } from '../../../../../api_common/api_auth';
import { Router } from '@angular/router';
import { ApiInterfaceUserInfo, UserInfo } from "../../../../../api_common/api_ldapquery"

type TokenClaims = {
    given_name: string,
    family_name: string,
    email: string,
    sid: string
};

function isTokenClaims(object: any): object is TokenClaims {
    return 'given_name' in object && typeof object['given_name'] == 'string'
        && 'family_name' in object && typeof object['family_name'] == 'string'
        && 'family_name' in object && typeof object['family_name'] == 'string'
        && 'email' in object && typeof object['email'] == 'string'
        && 'sid' in object && typeof object['sid'] == 'string'
}

@Injectable({
    providedIn: 'root'
})
export class SessionService {
    static AUTH_SERVER = "https://adfs.mittermeier-kraiburg.vet/adfs"
    static CLIENT_ID = "cf1b923f-dccc-4a60-b9dd-927fbbaa8953";
    static CALLBACK_URL = "https://internal.mittermeier-kraiburg.vet/login"
    static EXCHANGE_TOKEN_URL = "https://internal.mittermeier-kraiburg.vet/module/auth/generateToken"
    static REVOKE_TOKEN_URL = "https://internal.mittermeier-kraiburg.vet/module/auth/revokeToken"
    static USERINFO_URL = "https://internal.mittermeier-kraiburg.vet/module/ldapquery/userinfo"
    static REFRESH_TOKEN_URL = "https://internal.mittermeier-kraiburg.vet/module/auth/refreshToken"

    private _rawIdToken: string | undefined = undefined;
    private _rawAccessToken: string | undefined = undefined;
    private _rawRefreshToken: string | undefined = undefined;
    private _givenName: string = "<unset>";
    private _familyName: string = "<unset>";
    private _email: string = "<unset>";
    private _thumbnailPhoto?: string = undefined;
    private _sid: string | undefined = undefined;
    private _rawUserInfo: UserInfo | undefined = undefined;
    private _isLoggedIn: WritableSignal<boolean> = signal(false);

    constructor(private jwtHelperService: JwtHelperService,
        private errorlistService: ErrorlistService,
        private router: Router,
        private backend: BackendService
    ) { }

    public get givenName() { return this._givenName; }
    public get familyName() { return this._familyName; }
    public get email() { return this._email; }
    public get thumbnailPhoto() { return this._thumbnailPhoto; }
    public get isLoggedIn() { return this._isLoggedIn(); }
    public get refreshToken() { return this._rawRefreshToken };
    public get sid() { return this._sid };
    public get accessToken(): Promise<string> {
        // Our application propably wants to send this access token to the server. In case it is expired, automatically renew it using our stored renewToken().
        return new Promise(async (res, rej) => {
            try {
                console.log("User app requested access token...");
                if (this._rawAccessToken == undefined) {
                    console.log("Access token is undefined!");
                    this.unauthorizeSession("You are not logged in!").then(rej).catch(rej);
                    return;
                }

                const accessTokenIsStillValid = this.jwtHelperService.verifyExpirationClaim(this.jwtHelperService.parseJWTtoken(this._rawAccessToken));
                if (accessTokenIsStillValid) {
                    console.log("Access token is valid!");
                    res(this._rawAccessToken);
                    return;
                }

                console.log("Access token must be refreshed...");
                await this.forceRefreshToken();
                console.log("Access token was successfully refreshed!");
                res(this._rawAccessToken);
            } catch (e) {
                console.log("Error refreshing access token! Terminating session!");
                // Session ended and we couldn't refresh it. Unauthorize the user.
                this.unauthorizeSession("Your session timed out and we could not refresh it!").then(rej).catch(rej);
            }
        });
    };

    forceRefreshToken(): Promise<void> {
        return new Promise((res, rej) => {
            this.backend.anonymousBackendCall<ApiInterfaceRefreshToken>(SessionService.REFRESH_TOKEN_URL,
                JSON.stringify({ 'refresh_token': this._rawRefreshToken, 'id_token': this._rawIdToken }
                )).then(json => {
                    this._rawAccessToken = json.access_token;
                    if (json.refresh_token !== undefined) {
                        this._rawRefreshToken = json.refresh_token;
                    }
                    if (json.id_token !== undefined) {
                        let idtoken = json.id_token;
                        this._rawIdToken = idtoken;
                        this.parseIdToken(idtoken);
                    }
                    this.storeSessionInStore();
                    res();
                }).catch(err => {
                    rej(err);
                });
        });
    }

    authorizeSession() {
        const randomUUID = self.crypto.randomUUID();
        window.location.href = SessionService.AUTH_SERVER + "/oauth2/authorize?response_type=code&scope=openid&client_id=" + SessionService.CLIENT_ID + "&state=" + randomUUID + "&redirect_uri=" + encodeURIComponent(SessionService.CALLBACK_URL);
    }

    storeSessionInStore() {
        if (this._rawIdToken && this._rawAccessToken && this._rawRefreshToken && this._rawUserInfo) {
            sessionStorage.setItem("id", this._rawIdToken);
            sessionStorage.setItem("access", this._rawAccessToken);
            sessionStorage.setItem("refresh", this._rawRefreshToken);
            sessionStorage.setItem("info", JSON.stringify(this._rawUserInfo));
        } else {
            sessionStorage.removeItem("id");
            sessionStorage.removeItem("access");
            sessionStorage.removeItem("refresh");
            sessionStorage.removeItem("info");
        }
    }

    restoreSessionFromStore(): Promise<void> {
        return new Promise((res, rej) => {
            if (this._isLoggedIn()) {
                res();
                return;
            }

            const rawIdToken = sessionStorage.getItem("id");
            const rawAccessToken = sessionStorage.getItem("access");
            const rawRefreshToken = sessionStorage.getItem("refresh");
            const rawUserInfo = JSON.parse(sessionStorage.getItem("info") || "{}");

            if (rawIdToken !== null && rawAccessToken !== null && rawRefreshToken !== null && rawUserInfo !== null) {
                this._rawIdToken = rawIdToken;
                this._rawAccessToken = rawAccessToken;
                this._rawRefreshToken = rawRefreshToken;
                this._rawUserInfo = rawUserInfo;
                this.parseIdToken(rawIdToken);
                this.parseUserInfo(rawUserInfo);
                this._isLoggedIn.set(true);
                res();
            } else {
                this._rawIdToken = this._rawAccessToken = this._rawRefreshToken = this._rawUserInfo = undefined;
                this.storeSessionInStore();
                this._isLoggedIn.set(false);
                rej();
            }
            window.dispatchEvent(new Event("UserAuthenticated"));
        });
    }

    parseIdToken(rawToken: string): boolean {
        const idToken = this.jwtHelperService.parseJWTtoken(rawToken);
        const idTokenClaims = idToken.content;

        if (isTokenClaims(idTokenClaims)) {
            this._givenName = idTokenClaims.given_name;
            this._familyName = idTokenClaims.family_name;
            this._email = idTokenClaims.email;
            this._sid = idTokenClaims.sid;
            this._thumbnailPhoto = "";
            return true;
        } else {
            this.errorlistService.showErrorMessage("Invalid ID token given!");
        }
        return false;
    }

    parseUserInfo(rawDetails: any): boolean {
        if ('thumbnail' in rawDetails && typeof (rawDetails['thumbnail']) == 'string') {
            this._thumbnailPhoto = "data:image/jpg;base64," + rawDetails["thumbnail"];
            return true;
        }
        return false;
    }

    exchangeCodeForToken(code: string, state: string): Promise<void> {
        return new Promise((res, rej) => {
            this.backend.anonymousBackendCall<ApiInterfaceGenerateToken>(SessionService.EXCHANGE_TOKEN_URL, 
                JSON.stringify({ 'code': code, 'state': state })).then(async json => {
                this._rawIdToken = json.id_token;
                this._rawAccessToken = json.access_token;
                this._rawRefreshToken = json.refresh_token;
                if (this._rawIdToken && this._rawAccessToken && this._rawRefreshToken) {
                    this.parseIdToken(this._rawIdToken);
                    await this.resolveUserDetails();
                    this.storeSessionInStore();
                    this._isLoggedIn.set(true);
                    res();
                } else {
                    throw new Error("Invalid server response! Keys: " + Object.keys(json));
                }
            }).catch(err => {
                rej(err);
            });
        });
    }

    resolveUserDetails(): Promise<void> {
        return new Promise((res, rej) => {
            this.backend.authorizedBackendCall<ApiInterfaceUserInfo>(SessionService.USERINFO_URL).then(json => {
                console.log(json);
                this._rawUserInfo = json.userinfo;
                if (!this.parseUserInfo(json.userinfo)) {
                    this.errorlistService.showErrorMessage("Error parsing user details!");
                    console.error("Error parsing user details: ", json);
                }
                res();
            }).catch(err => {
                rej(err);
            });
        });
    }

    unauthorizeSession(reason: string): Promise<void> {
        return new Promise((res, rej) => {
            if (!this._isLoggedIn()) {
                setTimeout((() => { this.redirectClientToLoginPage(reason) }).bind(this), 100);
                rej();
                return;
            }

            this.backend.anonymousBackendCall(SessionService.REVOKE_TOKEN_URL,
                JSON.stringify({ 'id_token': this._rawIdToken })
            ).then(json => {
                sessionStorage.removeItem("id");
                sessionStorage.removeItem("access");
                sessionStorage.removeItem("refresh");
                this._isLoggedIn.set(false);
                this.restoreSessionFromStore();
                setTimeout((() => { this.redirectClientToLoginPage(reason) }).bind(this), 100);
                res();
            }).catch(err => {
                setTimeout((() => { this.redirectClientToLoginPage(reason) }).bind(this), 100);
                rej(err);
            });
        });
    }

    redirectClientToLoginPage(reason: string) {
        this.errorlistService.showErrorMessage(reason);
        this.router.navigateByUrl("/login");
    }
}
