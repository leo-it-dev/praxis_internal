import { ApiModule } from "../../api_module";
import { options } from "../../options";
import { ApiInterfaceUserInfoOut, UserInfo } from "../../../api_common/api_ldapquery";
import { ApiInterfaceEmptyIn, ApiModuleResponse } from "../../../api_common/backend_call";
import ldapjs = require('ldapjs');
import { Mutex } from "async-mutex";

export class ApiModuleLdapQuery extends ApiModule {

    private ldapConfig = {
        url: options.LDAP_URL,
        connectionTimeOut: 30000,
        reconnect: true
    };
    private ldapClient: ldapjs.Client;
    private ldapConnectMutex: Mutex;

    modname(): string {
        return "ldapquery";
    }

    async assureLdapConnected() {
        return new Promise<void>((res, _) => {
            if (this.ldapClient?.connected) {
                res();
            } else {
                this.ldapConnectMutex.acquire();

                this.ldapClient = ldapjs.createClient(this.ldapConfig);
                this.ldapClient.on('error', (err) => {
                    console.log("LDAP client disconnected. Next access will try to reconnect.", err);
                    this.ldapClient.unbind();
                    this.ldapClient.destroy();
                    this.ldapClient = undefined;
                });
                this.ldapClient.bind(options.LDAP_LOGIN_USER, options.LDAP_LOGIN_PASS, (error) => {
                    if (error) {
                        console.error("Error binding to LDAP user: " + options.LDAP_LOGIN_USER + ": " + error);
                    } else {
                        console.log("Successfully bound to LDAP user: " + options.LDAP_LOGIN_USER + "!");
                    }
                    this.ldapConnectMutex.release();
                    res();
                });
            }
        });
    }

    async initialize() {
        this.ldapConnectMutex = new Mutex();
        await this.assureLdapConnected();
    }

    loginRequired(): boolean {
        return true;
    }

    readUserInfo(userSID): Promise<UserInfo> {
        return new Promise(async (res, rej) => {
            try {
                let ldapEntry = await this.performLdapSearch(options.LDAP_USER_DN_BASE, {
                    filter: "(&(objectClass=user)(objectsid=" + userSID + "))",
                    scope: "sub",
                    attributes: '*'
                });

                if (ldapEntry == undefined) {
                    rej("no user with such sid found!");
                    return;
                }
                res({
                    // Append additional ActiveDirectory attributes needed here to add to the response
                    thumbnail: "data:image/jpg;base64," + ldapEntry.attributes.find(e => e.type == "thumbnailPhoto").buffers[0].toString('base64'),
                    vetproofVeterinaryName: ldapEntry.attributes.find(e => e.type == options.AD_ATTRIBUTE_QS_VETERINARY_ID).values[0]
                });
            } catch(err) {
                rej(err);
            }
        });
    }

    registerEndpoints(): void {
        this.get<ApiInterfaceEmptyIn, ApiInterfaceUserInfoOut>("userinfo", async (req, user) => {
            let result: ApiModuleResponse<ApiInterfaceUserInfoOut>;
            try {
                let userInfo = await this.readUserInfo(user.sid);
                result = { statusCode: 200, responseObject: {userinfo: userInfo}, error: undefined};
            } catch(err) {
                result = { statusCode: 400, responseObject: {userinfo: undefined}, error: err };
            }
            return result;
        });
    }

    performLdapSearch(baseDN: string, options: ldapjs.SearchOptions): Promise<ldapjs.SearchEntry | undefined> {
        return new Promise(async (resolve, reject) => {
            let entryFound = false;
            await this.assureLdapConnected();
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