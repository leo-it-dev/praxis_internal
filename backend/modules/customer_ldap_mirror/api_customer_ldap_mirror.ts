import { getRepeatedScheduler } from "../..";
import { UserPermission } from "../../../api_common/permission_types";
import { ApiModule } from "../../api_module";
import { validateKerberosTicket } from "../../framework/kerberos-handler";
import { AuthenticationResult, LdapMemoryServer } from "../../framework/ldap/ldap_memory_server";
import { constructLdapEntry, LdapStore } from "../../framework/ldap/ldap_store";
import { AuthenticationChoiceSasl } from "../../framework/ldap/messages/bind_request";
import { readCustomersFromMovetaDB } from "../../framework/moveta/moveta_functions";

const config = require('config');

export class ApiModuleCustomerLdapMirror extends ApiModule {

    memoryLdap!: LdapMemoryServer;
    memoryStore!: LdapStore;

    ldapBase: string = "";

    modname(): string {
        return "customer-ldap-mirror";
    }

    permissionRequired(): UserPermission | undefined {
        return undefined;
    }

    async initialize() {
        let ldapPort = config.get('ldap-mirror.PORT');
        let ldapHost = config.get('ldap-mirror.HOST');
        this.ldapBase = config.get('ldap-mirror.BASE_DN');
        let ldapSSL = config.get('ldap-mirror.SSL');
        let scrapeIntervalMin = config.get('ldap-mirror.SCRAPE_INTERVAL_MINUTES');

        this.memoryStore = new LdapStore();
        this.memoryLdap = new LdapMemoryServer(ldapPort, ldapHost, ldapSSL, this.ldapBase, {
            authenticateUser: (name, authentication) => {
                return new Promise<AuthenticationResult>((res, _) => {
                    if (authentication instanceof AuthenticationChoiceSasl && authentication.mechanism == "GSSAPI") {
                        validateKerberosTicket(authentication.credentials).then(dat => {
                            this.logger().info("User successfully authenticated using Kerberos!", {username: dat.username})
                            res(AuthenticationResult.SUCCESS);
                            return;
                        }).catch(err => {
                            this.logger().warn("User failed authenticating using Kerberos!", {error: err})
                            res(AuthenticationResult.FAILURE);
                            return;
                        });
                    } else {
                        this.logger().warn("User tried authenticated to ldap mirror using unsupported auth method!", {type: JSON.stringify(authentication)})
                        res(AuthenticationResult.METHOD_UNSUPPORTED);
                    }
                });
            }
        }, this.memoryStore);

        getRepeatedScheduler().scheduleRepeatedEvent(this, "scrape-customer-data", scrapeIntervalMin, (finished) => {
            this.scrapeCustomerData().then(() => {
                finished();
            });
        }, true);
    }

    async scrapeCustomerData() {
        this.logger().info("Scheduled update of internal database of customers!");
        
        readCustomersFromMovetaDB().then(customers => {
            this.memoryStore.replace(customers.map(cust => {
                let firstName = cust.givenName.trim() != "" ? cust.firstName.trim() : cust.firstName.trim().split(" ")[0];
                let surName = cust.givenName.trim() != "" ? cust.givenName.trim() : cust.firstName.trim().split(" ").splice(1).join(' ');

                let dn = "uid=cust-" + cust.uid + ",dc=pegasus," + this.ldapBase;

                return constructLdapEntry(dn, [
                    { attr: "dn", vals: [dn] },
                    { attr: "sn", vals: [surName] },
                    { attr: "cn", vals: [firstName + " " + surName] },
                    { attr: "givenName", vals: [firstName] },
                    { attr: "displayName", vals: [firstName + " " + surName] },
                    { attr: "telephoneNumber", vals: [cust.phone] },
                    { attr: "mobile", vals: [cust.phone] },
                    { attr: "mail", vals: [cust.email] },
                    { attr: "street", vals: [cust.street] },
                    { attr: "l", vals: ["Germany"] },
                    { attr: "st", vals: [cust.place] },
                    { attr: "postalCode", vals: [String(cust.plz)] },
                    { attr: "co", vals: ["DE"] },
                    { attr: "description", vals: [cust.memo] },
                    { attr: "objectClass", vals: ["top", "person", "organizationalPerson", "inetOrgPerson"] }
                ]);
            }));
            this.logger().info("Successfully updated list of customers!", {entryCount: this.memoryStore.getAllEntries().length});
        }).catch(err => {
            this.logger().error("Error updating internal database of customers!", {error: err});
        });
    }

    loginRequired(): boolean {
        return true;
    }

    registerEndpoints(): void {}
}