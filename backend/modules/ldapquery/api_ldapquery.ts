import { ApiModule } from "../../api_module";
import { ApiInterfaceUserInfoOut, UserInfo } from "../../../api_common/api_ldapquery";
import { ApiInterfaceEmptyIn, ApiModuleResponse } from "../../../api_common/backend_call";
import ldapjs = require('ldapjs');
import { Mutex } from "async-mutex";
const config = require('config');

export class ApiModuleLdapQuery extends ApiModule {

    private ldapConfig = {
        url: config.get('generic.LDAP_URL'),
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
                    console.log("LDAP client disconnected. Next access will try to reconnect.", err.code);
                    this.ldapClient.unbind();
                    this.ldapClient.destroy();
                    this.ldapClient = undefined;
                });
                this.ldapClient.bind(config.get('generic.LDAP_LOGIN_USER'), config.get('generic.LDAP_LOGIN_PASS'), (error) => {
                    if (error) {
                        console.error("Error binding to LDAP user: " + config.get('generic.LDAP_LOGIN_USER') + ": " + error);
                    } else {
                        console.log("Successfully bound to LDAP user: " + config.get('generic.LDAP_LOGIN_USER') + "!");
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

    findAttr(userSID: string, attributes: ldapjs.Attribute[], attrName: string) {
        let attr = attributes.find(e => e.type == attrName);
        if (attr) {
            return attr;
        } else {
            console.error("Error looking up ldap entry for user: " + userSID + " " + attrName);
            return undefined;
        }
    }

    readUserInfo(userSID): Promise<UserInfo> {
        return new Promise(async (res, rej) => {
            try {
                let ldapEntry = await this.performLdapSearch(config.get('generic.LDAP_USER_DN_BASE'), {
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
                    thumbnail: "data:image/jpg;base64," + (this.findAttr(userSID, ldapEntry.attributes, "thumbnailPhoto")?.buffers[0].toString('base64') ?? "<default>"),
                    vetproofVeterinaryName: this.findAttr(userSID, ldapEntry.attributes, config.get('generic.AD_ATTRIBUTE_QS_VETERINARY_ID'))?.values[0] ?? "<default>",
                    accName: this.findAttr(userSID, ldapEntry.attributes, config.get('generic.AD_ATTRIBUTE_QS_DOCUMENT_NUMBER_USER_NAME_PREFIX'))?.values[0] ?? "<default>"
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