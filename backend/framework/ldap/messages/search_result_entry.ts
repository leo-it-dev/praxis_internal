import * as asn1js from 'asn1js';
import { OctetString, TagClass } from '../utils';
import { ProtocolOpCode } from './ldap_message';
import { buildLdapResultComponents, LdapResult } from './ldap_result';

export type PartialAttribute = {
    type: OctetString,
    vals: OctetString[]
};

export type PartialAttributeList = PartialAttribute[]

export class SearchResultEntry {
    constructor(
        public objectName: OctetString,
        public attributes: PartialAttributeList
    ) {}
}

export class SearchResultReference {
    constructor(public uris: OctetString[]) {}
};

export class SearchResultDone {
    constructor(public ldapResult: LdapResult) {}
}

export function buildSearchResultEntry(data: SearchResultEntry): asn1js.Constructed {
    return new asn1js.Constructed({
        idBlock: {
            tagClass: TagClass.APPLICATION,
            tagNumber: ProtocolOpCode.searchResultEntry
        },
        value: [
            new asn1js.OctetString({ valueHex: data.objectName.bytes }),
            new asn1js.Sequence({
                value: data.attributes.map(a => new asn1js.Sequence({
                    value: [
                        new asn1js.OctetString({ valueHex: a.type.bytes }),
                        new asn1js.Set({ value: a.vals.map(v => new asn1js.OctetString({ valueHex: v.bytes })) })
                    ]
                }))
            })
        ]
    });
}

export function buildSearchResultReference(data: SearchResultReference): asn1js.Constructed {
    return new asn1js.Constructed({
        idBlock: {
            tagClass: TagClass.APPLICATION,
            tagNumber: ProtocolOpCode.searchResultReference
        },
        value: data.uris.map(uri => new asn1js.OctetString({ valueHex: uri.bytes }))
    });
}

export function buildSearchResultDone(data: SearchResultDone): asn1js.Constructed {
    return new asn1js.Constructed({
        idBlock: {
            tagClass: TagClass.APPLICATION,
            tagNumber: ProtocolOpCode.searchResultDone
        },
        value: buildLdapResultComponents(data.ldapResult)
    });
}
