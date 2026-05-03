import * as asn1js from 'asn1js';
import { Socket } from "net";
import { getLogger } from "../../logger";
import { LdapMemoryServer } from "./ldap_memory_server";
import { readBindRequest } from "./messages/bind_request";
import { BindResponse, buildBindResponse } from "./messages/bind_response";
import { buildLdapMessage, ProtocolOpCode, readLdapMessage } from "./messages/ldap_message";
import { LdapResult, LdapResultCode } from "./messages/ldap_result";
import { readSearchRequest } from "./messages/search_request";
import { buildSearchResultDone, buildSearchResultEntry, PartialAttribute } from "./messages/search_result_entry";
import { evaluateFilter, FilterResult } from './filter/filter';

export class LdapClientHandler {

    logger = getLogger("ldap-client-handler");

    getSocket() {
        return this.socket;
    }

    constructor(private socket: Socket, private ldapServer: LdapMemoryServer) {
        this.handleClientConnection(socket);
    }

    terminate() {
        this.ldapServer.terminate(this.socket);
    }

    sendLdapMessage(sequence: asn1js.Sequence) {
        let responseBytes = sequence.toBER(false);
        this.socket.write(Buffer.from(responseBytes));
    }

    handleClientConnection(socket: Socket) {
        this.logger.info("Client connected: ", { address: socket.remoteAddress });

        socket.on('data', d => {
            const nodes = asn1js.fromBER(d);
            if (nodes.offset == -1 || !(nodes.result instanceof asn1js.Constructed)) {
                this.terminate();
                return;
            }

            let ldapMessage = readLdapMessage(nodes.result);
            if (ldapMessage == undefined) {
                this.terminate();
                return;
            }

            if (ldapMessage.protocolOp.idBlock.tagNumber == ProtocolOpCode.bindRequest) {
                let bindRequest = readBindRequest(ldapMessage.protocolOp);
                if (!bindRequest) {
                    this.terminate();
                    return;
                }
                this.logger.info("Read bind request: ", { request: bindRequest });

                let authenticationSuccessfull = this.ldapServer.delegateAuthentication(bindRequest.name, bindRequest.authentication);

                let bindResponse = buildLdapMessage({
                    messageID: ldapMessage.messageID,
                    protocolOp: authenticationSuccessfull ?
                        buildBindResponse(
                            new BindResponse(new LdapResult(
                                LdapResultCode.success,
                                "",
                                "",
                                undefined
                            ), undefined)
                        )
                        :
                        buildBindResponse(
                            new BindResponse(new LdapResult(
                                LdapResultCode.invalidCredentials,
                                "",
                                "",
                                undefined
                            ), undefined)
                        )
                });

                this.sendLdapMessage(bindResponse);
                this.logger.info("Responded with bind response: ", { response: bindResponse });
            }

            if (ldapMessage.protocolOp.idBlock.tagNumber == ProtocolOpCode.unbindRequest) {
                // empty message body.
                this.terminate();
            }

            if (ldapMessage.protocolOp.idBlock.tagNumber == ProtocolOpCode.searchRequest) {
                let searchRequest = readSearchRequest(ldapMessage.protocolOp);

                if (!searchRequest) {
                    this.terminate();
                    return;
                }

                let ldapEntries = this.ldapServer.getLdapStore().getAllEntries();
                let matchedEntries = ldapEntries.filter(entry => evaluateFilter(entry, searchRequest.filter) == FilterResult.TRUE);

                // TODO: Evaluate everything left except filter from searchRequest

                for (let entry of matchedEntries) {
                    this.sendLdapMessage(buildLdapMessage({
                        messageID: ldapMessage.messageID,
                        protocolOp: buildSearchResultEntry({
                            objectName: entry.objectNameDN,
                            attributes: entry.attributes.map(a => {
                                return {
                                    type: a.type,
                                    vals: a.vals
                                } as PartialAttribute;
                            })
                        })
                    }));
                }

                this.sendLdapMessage(buildLdapMessage({
                    messageID: ldapMessage.messageID,
                    protocolOp: buildSearchResultDone({
                        ldapResult: new LdapResult(
                            LdapResultCode.success,
                            searchRequest?.baseObject.toString() || "",
                            "",
                            undefined
                        )
                    })
                }));
            }
            this.logger.info("Received LDAP message", { message: ldapMessage });
        });
    }
}