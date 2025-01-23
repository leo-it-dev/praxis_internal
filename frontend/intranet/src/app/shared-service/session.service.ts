import { Injectable, Signal, signal, WritableSignal } from '@angular/core';
import { JwtHelperService } from "./jwt-helper.service";
import { ErrorlistService } from '../errorlist/errorlist.service';

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

    private _rawIdToken: string|undefined = undefined;
    private _rawAccessToken: string|undefined = undefined;
    private _rawRefreshToken: string|undefined = undefined;
    private _givenName: string = "<unset>";
    private _familyName: string = "<unset>";
    private _email: string = "<unset>";
    private _thumbnailPhoto?: string = undefined;
    private _sid: string|undefined = undefined;
    private _rawUserInfo: string|undefined = undefined;
    private _isLoggedIn: WritableSignal<boolean> = signal(false);

    constructor(private jwtHelperService: JwtHelperService,
                private errorlistService: ErrorlistService
    ) { }

    public get givenName() { return this._givenName; }
    public get familyName() { return this._familyName; }
    public get email() { return this._email; }
    public get thumbnailPhoto() { return this._thumbnailPhoto; }
    public get isLoggedIn() { return this._isLoggedIn(); }
    public get accessToken() { return this._rawAccessToken };
    public get refreshToken() { return this._rawRefreshToken };
    public get sid() { return this._sid };
    
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
        // TODO: Validate rawDetails
        this._thumbnailPhoto = "data:image/jpg;base64," + rawDetails["thumbnail"];
        return true;
    }

    exchangeCodeForToken(code: string, state: string): Promise<void> {
        return new Promise((res, rej) => {
            fetch(SessionService.EXCHANGE_TOKEN_URL, {
                headers: {
                    'Accept': 'application/json',
                    'Content-Type': 'application/json'
                },
                method: 'POST',
                body: JSON.stringify({ 'code': code, 'state': state })
            }).then(async resp => {
                if (resp.ok) {
                    const json = (await resp.json())["content"];
                    this._rawIdToken = json['id_token'];
                    this._rawAccessToken = json['access_token'];
                    this._rawRefreshToken = json['refresh_token'];
                    if (this._rawIdToken && this._rawAccessToken && this._rawRefreshToken) {
                        this.parseIdToken(this._rawIdToken);
                        await this.resolveUserDetails();
                        this.storeSessionInStore();
                        this._isLoggedIn.set(true);
                        res();
                    } else {
                        throw new Error("Invalid server response! Keys: " + Object.keys(json));
                    }
                } else {
                    const text = await resp.text();
                    console.error("exchangeCodeForToken(2): ", text);
                    throw new Error("Server returned error code " + resp.status + "! Check log for further information!");
                }
            }).catch(err => {
                console.error(err);
                this.errorlistService.showErrorMessage("There was an error exchanging oauth2 code for OICD/OAuth2 tokens!");
                rej(err);
            });
        });
    }

    resolveUserDetails(): Promise<void> {
        return new Promise((res, rej) => {
            fetch(SessionService.USERINFO_URL, {
                headers: {
                    'Authorization': "Bearer " + this._rawAccessToken
                }
            }).then(async resp => {
                if (resp.ok) {
                    let json = await resp.json();
                    let error = json['error'];
                    let content = json['content'];
                    if (error) {
                        this.errorlistService.showErrorMessage("Internal server error reading user details: " + error);
                    } else {
                        this._rawUserInfo = content;
                        if (!this.parseUserInfo(content)) {
                            this.errorlistService.showErrorMessage("Error parsing user details!");
                            console.error("Error parsing user details: ", json);
                        }
                    }
                } else {
                    this.errorlistService.showErrorMessage("Error retrieving user details: " + resp.text());
                }
                res();
            });
        });
    }

    unauthorizeSession(): Promise<void> {
        return new Promise((res, rej) => {
            if (!this._isLoggedIn()) {
                rej();
                return;
            }

            fetch(SessionService.REVOKE_TOKEN_URL, {
                headers: {
                    'Accept': 'application/json',
                    'Content-Type': 'application/json'
                },
                method: 'POST',
                body: JSON.stringify({ 'id_token': this._rawIdToken })
            }).then(async resp => {
                if (resp.ok) {
                    const _ = (await resp.json())["content"];
                    sessionStorage.removeItem("id");
                    sessionStorage.removeItem("access");
                    sessionStorage.removeItem("refresh");
                    this._isLoggedIn.set(false);
                    this.restoreSessionFromStore();
                    res();
                } else {
                    const text = await resp.text();
                    console.error("unauthorizeSession(1): ", text);
                    throw new Error("Server returned error code " + resp.status + "! Check log for further information!");
                }
            }).catch(err => {
                console.log("unauthorizeSession(2): ", err);
                this.errorlistService.showErrorMessage("There was an error revoking oauth2 token!");
                rej(err);
            });
        });
    }
}

/* Local User profile picture: 
$user_sid = [System.Security.Principal.WindowsIdentity]::GetCurrent().User.Value
Path = Computer\HKEY_LOCAL_MACHINE\SOFTWARE\Microsoft\Windows\CurrentVersion\AccountPicture\Users\<user_sid>\Image1080
Sync to AD:
Set-ADUser <username> -Replace @{thumbnailPhoto=([byte[]](Get-Content "<path_to_image>" -Encoding byte))}
Write to AD users' thumbnailPhoto property!
Then send that property as claim
*/