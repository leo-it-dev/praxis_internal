import { Request } from "express";
import { AdfsOicdConfiguration } from "../options";
import { OidcInstance } from "./oidc_instance";

export abstract class AdfsOidc {
    private static adfsOidcInstance: OidcInstance;

    static async initialize() {
        AdfsOidc.adfsOidcInstance = await OidcInstance.construct(AdfsOicdConfiguration);
    }

    static getOidcProvider(): OidcInstance {
        return this.adfsOidcInstance;
    }

    /**
     * This function must not reject it's returned promise! It must indicate the validation state using the resolved boolean!
     * @returns JsonObject if the user is logged in and no error occurred, returnes an error message if the user is not logged in or the user's token could not be verified!
     */
    static async validateTokenInRequest(req: Request): Promise<string|JsonObject> {
        return new Promise(async (resolve, reject) => {
            if (AdfsOidc.adfsOidcInstance != undefined) {
                if (req.headers.authorization !== undefined && req.headers.authorization.toLowerCase().startsWith("bearer ")) {
                    let authToken = req.headers.authorization.substring(7);
                    AdfsOidc.adfsOidcInstance.validateJWTtoken(authToken).then(user => {
                        resolve(user);
                    }).catch(err => {
                        resolve("could not validate user token! error: " + String(err));
                    });
                } else {
                    resolve("could not validate user token! No token found or invalid type!");
                }
            } else {
                resolve("invalid internal server state. Could not verify token!");
            }
        });
    }
}
