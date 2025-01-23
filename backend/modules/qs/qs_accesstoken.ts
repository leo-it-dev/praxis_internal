import * as jwtHelper from '../../utilities/jwt_helper'
import * as utils from '../../utilities/utilities'
import {options} from '../../options'

export class QsAccessToken {
    tokenRaw : string;
    expIso : string;
    soapId : string;
    clrc : number;
    scope: [string]
    iss : string
    expTimestamp: number
    type: string
    userId : number

    constructor(tokenStr: string) {
        this.tokenRaw = tokenStr
        this.parseToken(tokenStr);
    }

    parseToken(tokenStr: string) {
        let jwtToken = jwtHelper.parseJWTtoken(tokenStr);
        this.expIso = jwtToken.content['expIso'];
        this.soapId = jwtToken.content['soapId'];
        this.clrc = jwtToken.content['clrc'];
        this.scope = jwtToken.content['scope'];
        this.iss = jwtToken.content['iss'];
        this.expTimestamp = parseInt(jwtToken.content['exp']) * 1000;
        this.type = jwtToken.content['type'];
        this.userId = jwtToken.content['userId'];
    }

    getExpirationTimeString() {
        return new Date(this.expTimestamp).toLocaleString('de-DE', {'timeZone': utils.getSystemTimeZone()});
    }

    isTokenStillValid() {
        return this.expTimestamp > new Date().getTime() + options.TOKEN_EXPIRATION_SAFETY_MARGIN_SECONDS_QS*1000;
    }

    getRawToken() {
        return this.tokenRaw;
    }
}