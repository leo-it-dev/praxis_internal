import * as asn1js from 'asn1js';
import { buildLdapResultComponents, LdapResult } from './ldap_result';
import { optional, TagClass } from '../utils';
import { ProtocolOpCode } from './ldap_message';

export class BindResponse {
    constructor(
        public ldapResult: LdapResult,
        public serverSaslCreds: Uint8Array | undefined
    ) {}
}

export function buildBindResponse(data: BindResponse): asn1js.Constructed {
    return new asn1js.Constructed({
        idBlock: {
            tagClass: TagClass.APPLICATION,
            tagNumber: ProtocolOpCode.bindResponse
        },
        value: [
            ...buildLdapResultComponents(data.ldapResult),
            ...optional(data.serverSaslCreds, v => new asn1js.OctetString({
                    idBlock: {
                        tagClass: TagClass.CONTEXT_SPECIFIC,
                        tagNumber: 7
                    },
                    valueHex: v
                }))
        ]
    });
}