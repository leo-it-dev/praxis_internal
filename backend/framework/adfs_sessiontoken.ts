import * as jwtHelper from '../utilities/jwt_helper'
import * as utils from '../utilities/utilities'
import {options} from '../options'

// https://learn.microsoft.com/de-de/entra/identity-platform/id-token-claims-reference
export class AdfsSessionToken {
    tokenRaw : string;
    authorizationInitiatedTimestamp: number;
    notBeforeTimestamp: number;
    expirationTimestamp: number;
    uniqueName: string; // m-kraiburg\\test
    userPrincipalName: string; // test@mittermeier-kraiburg.vet
    userEmail: string;
    userRoles: [string];
    givenName: string;
    familyName: string;
    thumbnailPhoto: string;

    constructor(tokenStr: string) {
        this.tokenRaw = tokenStr
        this.parseToken(tokenStr);
    }

    parseToken(tokenStr: string) {
        let {header, content, hash} = jwtHelper.parseJWTtoken(tokenStr);
        this.authorizationInitiatedTimestamp = parseInt(content["iat"]);
        this.notBeforeTimestamp = parseInt(content["nbf"]);
        this.expirationTimestamp = parseInt(content["exp"]);
        this.uniqueName = content["unique_name"];
        this.userPrincipalName = content["upn"];
        this.userRoles = content["roles"];
        this.givenName = content["given_name"];
        this.familyName = content["family_name"];
        this.userEmail = content["email"];
        this.thumbnailPhoto = content["thumbnail_photo"];
    }

    getExpirationTimeString() {
        return new Date(this.expirationTimestamp).toLocaleString('de-DE', {'timeZone': utils.getSystemTimeZone()});
    }

    isTokenStillValid() {
        return this.expirationTimestamp > new Date().getTime() + options.TOKEN_EXPIRATION_SAFETY_MARGIN_SECONDS_ADFS*1000;
    }

    getRawToken() {
        return this.tokenRaw;
    }
}