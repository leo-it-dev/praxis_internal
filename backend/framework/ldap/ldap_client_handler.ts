import * as asn1js from 'asn1js';
import { Socket } from "net";
import { getLogger } from "../../logger";
import { AuthenticationResult, LdapMemoryServer } from "./ldap_memory_server";
import { readBindRequest } from "./messages/bind_request";
import { BindResponse, buildBindResponse } from "./messages/bind_response";
import { buildLdapMessage, ProtocolOpCode, readLdapMessage } from "./messages/ldap_message";
import { LdapResult, LdapResultCode } from "./messages/ldap_result";
import { readSearchRequest, SearchRequestScope } from "./messages/search_request";
import { buildSearchResultDone, buildSearchResultEntry, PartialAttribute } from "./messages/search_result_entry";
import { evaluateFilter, FilterResult } from './filter/filter';
import { LdapAttribute, LdapEntry } from './ldap_store';

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

        socket.on('data', async d => {
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

                let authenticationResult = await this.ldapServer.delegateAuthentication(bindRequest.name, bindRequest.authentication);

                let bindResponse = buildLdapMessage({
                    messageID: ldapMessage.messageID,
                    protocolOp: authenticationResult == AuthenticationResult.SUCCESS ?
                        buildBindResponse(
                            new BindResponse(new LdapResult(
                                LdapResultCode.success,
                                "",
                                "",
                                undefined
                            ), undefined)
                        )
                        :
                        (authenticationResult == AuthenticationResult.FAILURE ?
                        buildBindResponse(
                            new BindResponse(new LdapResult(
                                LdapResultCode.invalidCredentials,
                                "",
                                "",
                                undefined
                            ), undefined)
                        )
                        : 
                        buildBindResponse(
                            new BindResponse(new LdapResult(
                                LdapResultCode.authMethodNotSupported,
                                "",
                                "",
                                undefined
                            ), undefined)
                        ))
                });

                this.sendLdapMessage(bindResponse);
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
                let matchedEntries: LdapEntry[] = [];
                let startTime = new Date().getTime();

                // TODO: Maybe implement
                // attributes
                // derefAliases
                // baseObject
                // scope
                // in the future.

                for (let entry of ldapEntries) {
                    if (searchRequest.timeLimit != 0 && (new Date().getTime() - startTime) / 1000 > searchRequest.timeLimit) {
                        break;
                    }
                    if (evaluateFilter(entry, searchRequest.filter) == FilterResult.TRUE) {
                        if (searchRequest.typesOnly) {
                            matchedEntries.push(new LdapEntry(
                                entry.objectNameDN,
                                entry.attributes.map(a => {
                                    return {
                                        type: a.type,
                                        vals: []
                                    }
                                }),
                            ));
                        } else {
                            matchedEntries.push(entry);
                        }

                        if (searchRequest.sizeLimit != 0 && matchedEntries.length >= searchRequest.sizeLimit) {
                            break;
                        }
                    }
                }

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