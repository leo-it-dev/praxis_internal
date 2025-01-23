import { ApiModule } from "../../api_module";
import { AdfsOidc } from "../../framework/adfs_oidc_instance";
import { AdfsSessionToken } from "../../framework/adfs_sessiontoken";
import { options } from "../../options";
import * as ssl from '../../ssl/ssl'

export class ApiModuleAuth extends ApiModule {

    modname(): string {
        return "auth";
    }

    async initialize() {}

    loginRequired(): boolean {
        return false;
    }

    registerEndpoints(): void {
        this.postJson("generateToken", async (req, _) => {
            const code = req.body['code'];
            const stateUUID = req.body['state'];

            const bodyContent = "grant_type=authorization_code&code=" + code + "&redirect_uri=" + encodeURIComponent(options.ADFS_INTRANET_REDIRECT_URL_LOGIN);

            try {
                let res = await ssl.httpsRequest(
                    options.HOSTNAME_ADFS, options.ADFS_URL_TOKEN,
                    'POST', bodyContent,
                    'application/x-www-form-urlencoded', 'Basic ' + btoa(options.ADFS_INTRANET_CLIENT_ID + ":" + options.ADFS_INTRANET_CLIENT_SECRET));
                    
                    try {
                        const body = JSON.parse(res.data);
                        if ("id_token" in body && "access_token" in body && "refresh_token" in body) {
                            const idToken = body["id_token"];
                            const accessToken = body["access_token"];
                            const refreshToken = body["refresh_token"];

                            await AdfsOidc.getOidcProvider().validateJWTtoken(idToken);
                            await AdfsOidc.getOidcProvider().validateJWTtoken(accessToken);

                            const adfsToken = new AdfsSessionToken(idToken);
                            console.log("User authenticated: ", adfsToken.userPrincipalName);

                            return {statusCode: 200, responseObject: { 'id_token': idToken, 'access_token': accessToken, 'refresh_token': refreshToken }, error: undefined};
                        } else {
                            throw new Error("Client sent invalid request body to /generateToken");
                        }
                    } catch (e) {
                        console.log("Error validating ID token while user tries to log in: ", e);
                        return {statusCode: 500, responseObject: {}, error: 'Signature check failed on ADFS returned ID Token!'};
                    }
            } catch(err) {
                console.error(err);
                return {statusCode: 500, responseObject: {}, error: 'An internal error occurred!'};
            }
        });

        this.postJson("revokeToken", async (req, _) => {
            const idtoken = req.body['id_token'];
            const bodyContent = "id_token_hint=" + idtoken + "&post_logout_redirect_uri=" + options.ADFS_INTRANET_REDIRECT_URL_LOGOUT;

            try {
                let resp = await ssl.httpsRequest(
                    options.HOSTNAME_ADFS, options.ADFS_URL_LOGOUT,
                    'POST', bodyContent,
                    'application/x-www-form-urlencoded', 'Basic ' + btoa(options.ADFS_INTRANET_CLIENT_ID + ":" + options.ADFS_INTRANET_CLIENT_SECRET));

                // TODO: Verify status code
                if (resp.statusCode == 200) {
                    const adfsToken = new AdfsSessionToken(idtoken);
                    console.log("User logged out: ", adfsToken.userPrincipalName);
                    return {statusCode: 200, responseObject: {}, error: undefined};
                } else {
                    console.error("User log out failed! ADFS returned invalid status code: " + resp.statusCode + " data: " + resp.data);
                    return {statusCode: 500, responseObject: {}, error: 'An internal error occurred! ADFS returned invalid status code ' + resp.statusCode};
                }
            } catch(err) {
                console.error("An internal error occurred trying to log out user: ", err);
                return {statusCode: 500, responseObject: {}, error: 'An internal error occurred!'};
            }
        });
    }
}