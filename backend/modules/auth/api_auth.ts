import { ApiModule } from "../../api_module";
import { AdfsOidc } from "../../framework/adfs_oidc_instance";
import { AdfsSessionToken } from "../../framework/adfs_sessiontoken";
import { ApiInterfaceGenerateTokenIn, ApiInterfaceGenerateTokenOut, ApiInterfaceRefreshTokenIn, ApiInterfaceRefreshTokenOut, ApiInterfaceRevokeTokenIn, JwtError, JwtErrorType } from "../../../api_common/api_auth"
import * as ssl from '../../ssl/ssl'
import { ApiInterfaceEmptyOut } from "../../../api_common/backend_call";
const config = require('config');

export class ApiModuleAuth extends ApiModule {

    modname(): string {
        return "auth";
    }

    async initialize() {}

    loginRequired(): boolean {
        return false;
    }

    registerEndpoints(): void {
        this.postJson<ApiInterfaceGenerateTokenIn, ApiInterfaceGenerateTokenOut>("generateToken", async (req, _) => {
            const bodyContent = "grant_type=authorization_code&code=" + req.body.code + "&redirect_uri=" + encodeURIComponent(config.get('generic.ADFS_INTRANET_REDIRECT_URL_LOGIN'));

            try {
                let res = await ssl.httpsRequest(
                    config.get('generic.HOSTNAME_ADFS'), AdfsOidc.getOidcProvider().getConfiguration().tokenEndpointUrl.pathname,
                    'POST', bodyContent,
                    'application/x-www-form-urlencoded', 'Basic ' + btoa(config.get('generic.ADFS_INTRANET_CLIENT_ID') + ":" + config.get('generic.ADFS_INTRANET_CLIENT_SECRET')));
                    
                    try {
                        const body = JSON.parse(res.data);
                        if ("id_token" in body && "access_token" in body && "refresh_token" in body) {
                            const idToken = body["id_token"];
                            const accessToken = body["access_token"];
                            const refreshToken = body["refresh_token"];

                            await AdfsOidc.getOidcProvider().validateJWTtoken(idToken);
                            await AdfsOidc.getOidcProvider().validateJWTtoken(accessToken);

                            const adfsToken = new AdfsSessionToken(idToken);
                            
                            this.logger().debug("User authenticated!", {username: adfsToken.userPrincipalName});

                            return {statusCode: 200, responseObject: { id_token: idToken, access_token: accessToken, refresh_token: refreshToken }, error: undefined};
                        } else {
                            this.logger().error("Body of /generateToken invalid!", {body: body});
                            throw new Error("Client sent invalid request body to /generateToken");
                        }
                    } catch (e) {
                        this.logger().error("Error validating ID token while user tries to log in!", {error: e});
                        return {statusCode: 500, responseObject: {id_token: undefined, access_token: undefined, refresh_token: undefined}, error: 'Signature check failed on ADFS returned ID Token!'};
                    }
            } catch(err) {
                this.logger().error("Unhandled error occurred!", {error: err});
                return {statusCode: 500, responseObject: {access_token: undefined, id_token: undefined, refresh_token: undefined}, error: 'An internal error occurred!'};
            }
        });

        this.postJson<ApiInterfaceRevokeTokenIn, ApiInterfaceEmptyOut>("revokeToken", async (req, _) => {
            const bodyContent = "id_token_hint=" + req.body.id_token + "&post_logout_redirect_uri=" + config.get('generic.ADFS_INTRANET_REDIRECT_URL_LOGOUT');

            try {
                let resp = await ssl.httpsRequest(
                    config.get('generic.HOSTNAME_ADFS'), AdfsOidc.getOidcProvider().getConfiguration().logoutUrl.pathname,
                    'POST', bodyContent,
                    'application/x-www-form-urlencoded', 'Basic ' + btoa(config.get('generic.ADFS_INTRANET_CLIENT_ID') + ":" + config.get('generic.ADFS_INTRANET_CLIENT_SECRET')));

                if (resp.statusCode == 200) {
                    const adfsToken = new AdfsSessionToken(req.body.id_token);
                    this.logger().debug("User logged out!", {username: adfsToken.userPrincipalName});
                    return {statusCode: 200, responseObject: {}, error: undefined};
                } else {
                    this.logger().error("User log out failed! ADFS returned invalid status code!", {statusCode: resp.statusCode, data: resp.data});
                    return {statusCode: 500, responseObject: {}, error: 'An internal error occurred! ADFS returned invalid status code ' + resp.statusCode};
                }
            } catch(err) {
                this.logger().error("An internal error occurred trying to log out user!", {error: err});
                return {statusCode: 500, responseObject: {}, error: 'An internal error occurred!'};
            }
        });

        this.postJson<ApiInterfaceRefreshTokenIn, ApiInterfaceRefreshTokenOut>("refreshToken", async (req, _) => {
            const bodyContent = "grant_type=refresh_token&refresh_token=" + req.body.refresh_token;
            
            try {
                let res = await ssl.httpsRequest(
                    config.get('generic.HOSTNAME_ADFS'), AdfsOidc.getOidcProvider().getConfiguration().tokenEndpointUrl.pathname,
                    'POST', bodyContent,
                    'application/x-www-form-urlencoded', 'Basic ' + btoa(config.get('generic.ADFS_INTRANET_CLIENT_ID') + ":" + config.get('generic.ADFS_INTRANET_CLIENT_SECRET')));
                if (res.statusCode == 200) {
                    const body = JSON.parse(res.data);
                    let responseObject = {access_token: undefined, refresh_token: undefined, id_token: undefined};

                    if ("access_token" in body) {
                        let accessToken = body["access_token"];
                        responseObject.access_token = accessToken;
                        await AdfsOidc.getOidcProvider().validateJWTtoken(accessToken);
                    } else {
                        throw new Error("Server returned invalid response in request to client querying /refreshToken! Answer does not contain a new access token!");
                    }
                    if ("refresh_token" in body) {
                        responseObject.refresh_token = body["refresh_token"];
                    }
                    if ("id_token" in body) {
                        responseObject.id_token = body["id_token"];
                    }

                    this.logger().debug("User successfully refreshed it's access token!");
                    return {statusCode: 200, responseObject: responseObject, error: undefined};
                } else if(res.statusCode == 400) {
                    this.logger().error("Server returned 400 while refreshing token!", {data: res.data});
                    return {statusCode: 401, responseObject: undefined, error: "Invalid grant! Refresh token may be expired!"};
                } else {
                    throw new Error("Server returned invalid response while user is trying to refresh it's access token!: " + res.statusCode + ", " + res.data);
                }
            } catch(err) {
                this.logger().error("An internal error occurred trying to refresh access token!", {error: err});
                return {statusCode: 500, responseObject: {access_token: undefined, id_token: undefined, refresh_token: undefined}, error: 'An internal error occurred!'};
            }
        });
    }
}