import { ApiModule } from "../../api_module";
import { options } from "../../options";
import { ApiInterfaceUserInfo, UserInfo } from "../../../api_common/api_ldapquery";
import { ApiModuleResponse } from "../../../api_common/backend_call";
import ldapjs = require('ldapjs');

export class ApiModuleLdapQuery extends ApiModule {

    private ldapConfig = {
        url: options.LDAP_URL,
        connectionTimeOut: 30000,
        reconnect: true
    };
    private ldapClient: ldapjs.Client;

    modname(): string {
        return "ldapquery";
    }

    async initialize() {
        this.ldapClient = ldapjs.createClient(this.ldapConfig);
        this.ldapClient.bind(options.LDAP_LOGIN_USER, options.LDAP_LOGIN_PASS, (error) => {
            if (error) {
                throw new Error("Error binding to LDAP user: " + options.LDAP_LOGIN_USER + ": " + error);
            } else {
                console.log("Successfully bound to LDAP user: " + options.LDAP_LOGIN_USER + "!");
            }
        });
    }

    loginRequired(): boolean {
        return true;
    }

    registerEndpoints(): void {
        this.get<ApiInterfaceUserInfo>("userinfo", async (req, user) => {
            let result: ApiModuleResponse<ApiInterfaceUserInfo>;
            try {
                let ldapEntry = await this.performLdapSearch(options.LDAP_USER_DN_BASE, {
                    filter: "(&(objectClass=user)(objectsid=" + user.sid + "))",
                    scope: "sub",
                    attributes: '*'
                });

                if (ldapEntry == undefined) {
                    result = { statusCode: 400, responseObject: {userinfo: undefined}, error: "no user with such sid found!" };
                } else {
                    // Append additional ActiveDirectory attributes needed here to add to the response
                    result = { statusCode: 200, responseObject: {userinfo: {
                        thumbnail: ldapEntry.attributes.find(e => e.type == "thumbnailPhoto").buffers[0].toString('base64')
                    }}, error: undefined};
                }
            } catch(err) {
                result = { statusCode: 400, responseObject: {userinfo: undefined}, error: err };
            }
            return result;
        });
    }

    performLdapSearch(baseDN: string, options: ldapjs.SearchOptions): Promise<ldapjs.SearchEntry | undefined> {
        return new Promise((resolve, reject) => {
            let entryFound = false;
            this.ldapClient.search(baseDN, options, function (err, res) {
                if (err) {
                    reject(err.message);
                } else {
                    res.on('searchEntry', function (entry) {
                        entryFound = true;
                        resolve(entry);
                    });
                    res.on('error', function (err) {
                        reject(err.message);
                    });
                    res.on('end', (res) => {
                        if(!entryFound) {
                            resolve(undefined);
                        }
                    })
                }
            });
        });
    }
}