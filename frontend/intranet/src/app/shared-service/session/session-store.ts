import { signal, WritableSignal } from "@angular/core";
import { UserInfo } from "../../../../../../api_common/api_ldapquery";
import { SessionProviderService } from "./session-provider.service";

export class SessionStore {
    _provider: SessionProviderService;
    constructor(provider: SessionProviderService) {
        this._provider = provider;
    }

    private _rawIdToken: WritableSignal<string | undefined> = signal(undefined);
            _rawAccessToken: WritableSignal<string | undefined> = signal(undefined);
    private _rawRefreshToken: WritableSignal<string | undefined> = signal(undefined);
    private _lazyloadUserInfo: WritableSignal<UserInfo | undefined> = signal(undefined);
    private _givenName: WritableSignal<string> = signal("<unset>");
    private _familyName: WritableSignal<string> = signal("<unset>");
    private _email: WritableSignal<string> = signal("<unset>");
    private _sid: WritableSignal<string | undefined> = signal(undefined);
    private _isLoggedIn: WritableSignal<boolean> = signal(false);

    public get idToken(): string|undefined { return this._rawIdToken(); }
    public get givenName() { return this._givenName(); }
    public get familyName() { return this._familyName(); }
    public get email() { return this._email(); }
    public get thumbnailPhoto() { return this._lazyloadUserInfo()?.thumbnail; }
    public get isLoggedIn() { return this._isLoggedIn(); }
    public get sid(): string|undefined { return this._sid() };
    public get qsVeterinaryName() { return this._lazyloadUserInfo()?.vetproofVeterinaryName };
    public get refreshToken(): string|undefined { return this._rawRefreshToken(); }
    public get lazyloadUserInfo(): UserInfo|undefined { return this._lazyloadUserInfo(); };
    public get accessToken(): Promise<string> {
        console.log("User app requested access token...");
        if (this._rawAccessToken() == undefined) {
            return new Promise((_, rej) => {
                console.log("Access token is undefined!");
                this._provider.unauthorizeSession("You are not logged in!").then(rej).catch(rej);
            });
        }

        if (this._provider.session) {
            return this._provider.session?.getAccessToken();
        } else {
            return Promise.reject("No session provider provided!");
        }
    };

    public set idToken(idToken: string|undefined) { this._rawIdToken.set(idToken); this._provider.parseIdToken(); }
    public set givenName(givenName: string) { this._givenName.set(givenName); }
    public set familyName(familyName: string) { this._familyName.set(familyName); }
    public set email(email: string) { this._email.set(email); }
    public set isLoggedIn(loggedIn: boolean) { this._isLoggedIn.set(loggedIn); }
    public set sid(sid: string) { this._sid.set(sid); };
    public set lazyloadUserInfo(lazyload: UserInfo|undefined) { this._lazyloadUserInfo.set(lazyload); };
    public set refreshToken(refreshToken: string|undefined) { this._rawRefreshToken.set(refreshToken); }
    public set accessToken(accessToken: string|undefined) { this._rawAccessToken.set(accessToken); }
}
