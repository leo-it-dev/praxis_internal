import { ApiModule } from "../../api_module";
import { ApiInterfaceUserInfoOut, ApiInterfaceUsersListInfoOut, UserInfo } from "../../../api_common/api_ldapquery";
import { ApiInterfaceEmptyIn, ApiModuleResponse } from "../../../api_common/backend_call";
import ldapjs = require('ldapjs');
import { Mutex } from "async-mutex";
import { UserPermission } from "../../../api_common/permission_types";
import { userPermissionsFromSecurityGroupDNs, expandSecurityGroupNameToFullDN } from "../../user";
import { ensureIsList } from "../../utilities/utilities";

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

    permissionRequired(): UserPermission | undefined {
        return undefined;
    }

    async assureLdapConnected() {
        return new Promise<void>((res, _) => {
            if (this.ldapClient?.connected) {
                res();
            } else {
                this.ldapConnectMutex.acquire();

                this.ldapClient = ldapjs.createClient(this.ldapConfig);
                this.ldapClient.on('error', (err) => {
                    this.logger().warn("LDAP client disconnected. Next access will try to reconnect.", {errorCode: err.code});
                    this.ldapClient.unbind();
                    this.ldapClient.destroy();
                    this.ldapClient = undefined;
                });
                this.ldapClient.bind(config.get('generic.LDAP_LOGIN_USER'), config.get('generic.LDAP_LOGIN_PASS'), (error) => {
                    if (error) {
                        this.logger().error("Error binding to LDAP user!", {username: config.get('generic.LDAP_LOGIN_USER'), error: error});
                    } else {
                        this.logger().info("Successfully bound to LDAP user!", {username: config.get('generic.LDAP_LOGIN_USER')});
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

    findAttr(attributes: ldapjs.Attribute[], attrName: string) {
        let attr = attributes.find(e => e.type == attrName);
        if (attr) {
            return attr;
        } else {
            return undefined;
        }
    }

    userInfoFromLdapSearchEntry(ldapEntry: ldapjs.SearchEntry): UserInfo {
        let thumbnail = this.findAttr(ldapEntry.attributes, "thumbnailPhoto");

        let permissions = userPermissionsFromSecurityGroupDNs(
            ensureIsList(
                this.findAttr(ldapEntry.attributes, "memberOf")?.values ?? []
            )
        );

        return {
            // Append additional ActiveDirectory attributes needed here to add to the response
            thumbnail: thumbnail !== undefined ? "data:image/jpg;base64," + (thumbnail?.buffers[0].toString('base64')) : null,
            vetproofVeterinaryName: this.findAttr(ldapEntry.attributes, config.get('generic.AD_ATTRIBUTE_QS_VETERINARY_ID'))?.values[0] ?? "<default>",
            accName: this.findAttr(ldapEntry.attributes, config.get('generic.AD_ATTRIBUTE_QS_DOCUMENT_NUMBER_USER_NAME_PREFIX'))?.values[0] ?? "<default>",
            permissions: permissions,
            firstName: this.findAttr(ldapEntry.attributes, config.get('generic.AD_ATTRIBUTE_FIRST_NAME'))?.values[0] ?? "<default>",
            givenName: this.findAttr(ldapEntry.attributes, config.get('generic.AD_ATTRIBUTE_GIVEN_NAME'))?.values[0] ?? "<default>",
        };
    }

    readUserInfo(userSID): Promise<UserInfo> {
        return new Promise(async (res, rej) => {
            try {
                let ldapEntries = await this.performLdapSearch(config.get('generic.LDAP_USER_DN_BASE'), {
                    filter: "(&(objectClass=user)(objectsid=" + userSID + "))",
                    scope: "sub",
                    attributes: '*'
                });

                if (ldapEntries == undefined) {
                    rej("no user with such sid found!");
                    return;
                }
                if (ldapEntries.length > 1) {
                    rej("More than one user with that sid found!");
                    return;
                }
                let ldapUser = ldapEntries[0];

                res(this.userInfoFromLdapSearchEntry(ldapUser));
            } catch(err) {
                rej(err);
            }
        });
    }

    readAllUserInfos(): Promise<UserInfo[]> {
        return new Promise(async (res, rej) => {
            try {
                let secGroupDNAllowLogin = expandSecurityGroupNameToFullDN(config.get("userPermissions.SECURITY_GROUP_ALLOW_INTRANET_LOGIN"));

                let ldapEntries = await this.performLdapSearch(config.get('generic.LDAP_USER_DN_BASE'), {
                    filter: "(&(objectClass=user)(memberOf=" + secGroupDNAllowLogin + "))",
                    scope: "sub",
                    attributes: '*'
                });

                if (ldapEntries == undefined) {
                    rej("no users in such group found!");
                    return;
                }

                let userInfos = ldapEntries.map(e => this.userInfoFromLdapSearchEntry(e))
                res(userInfos);
            } catch(err) {
                rej(err);
            }
        });
    }

    registerEndpoints(): void {
        this.get<ApiInterfaceEmptyIn, ApiInterfaceUserInfoOut>("userinfo", async (req, user) => {
            let result: ApiModuleResponse<ApiInterfaceUserInfoOut>;
            try {
                let userInfo = await this.readUserInfo(user.userTokenData.sid);
                result = { statusCode: 200, responseObject: {userinfo: userInfo, usergrants: user.userPermissions.values()}, error: undefined};
            } catch(err) {
                result = { statusCode: 400, responseObject: {userinfo: undefined, usergrants: undefined}, error: err };
            }
            return result;
        });
        this.get<ApiInterfaceEmptyIn, ApiInterfaceUsersListInfoOut>("users", async (req, user) => {
            let result: ApiModuleResponse<ApiInterfaceUsersListInfoOut>;
            try {
                let userInfos = await this.readAllUserInfos();
                result = { statusCode: 200, responseObject: {userinfos: userInfos }, error: undefined};
            } catch(err) {
                result = { statusCode: 400, responseObject: {userinfos: undefined }, error: err };
            }
            return result;
        });
    }

    performLdapSearch(baseDN: string, options: ldapjs.SearchOptions): Promise<ldapjs.SearchEntry[] | undefined> {
        return new Promise(async (resolve, reject) => {
            await this.assureLdapConnected();
            let entries = [];
            this.ldapClient.search(baseDN, options, function (err, res) {
                if (err) {
                    reject(err.message);
                } else {
                    res.on('searchEntry', function (entry) {
                        entries.push(entry);
                    });
                    res.on('error', function (err) {
                        reject(err.message);
                    });
                    res.on('end', (res) => {
                        if(entries.length == 0) {
                            resolve(undefined);
                        } else {
                            resolve(entries);
                        }
                    })
                }
            });
        });
    }
}