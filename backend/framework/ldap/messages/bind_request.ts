import * as asn1js from 'asn1js';
import { decodeLdapString } from '../utils';

export class AuthenticationChoiceSimple {
    constructor(public auth: Uint8Array) {}
}
export class AuthenticationChoiceSasl {
    constructor(public mechanism: string, public credentials: Uint8Array) {}
}

export type BindRequest = {
    version: number;
    name: string; // LDAPDN (more constrained)
    authentication: AuthenticationChoiceSimple | AuthenticationChoiceSasl; // AuthenticationChoice
}

export function readBindRequest(root: asn1js.Constructed): BindRequest | undefined {
    if (root.valueBlock.value.length != 3) {
        return undefined;
    }

    if (!(root.valueBlock.value[0] instanceof asn1js.Integer)) {
        return undefined;
    }

    if (!(root.valueBlock.value[1] instanceof asn1js.OctetString)) {
        return undefined;
    }

    let version = root.valueBlock.value[0].valueBlock.valueDec;
    let name = decodeLdapString(root.valueBlock.value[1].valueBlock.valueHexView);
    let authenticationMethod = undefined;

    if (root.valueBlock.value[2].idBlock.tagNumber == 0) { // simple auth
        let buffer = root.valueBlock.value[2] as any as asn1js.OctetString; // asn1js doesn't model context specific tagging.
        authenticationMethod = new AuthenticationChoiceSimple(buffer.valueBlock.valueHexView);
    } else if(root.valueBlock.value[2].idBlock.tagNumber == 3) { // sasl auth
        if (!(root.valueBlock.value[2] instanceof asn1js.Constructed)) {
            return undefined;
        }
        if (!(root.valueBlock.value[2].valueBlock.value[0] instanceof asn1js.OctetString)) {
            return undefined;
        }
        if (!(root.valueBlock.value[2].valueBlock.value[1] instanceof asn1js.OctetString)) {
            return undefined;
        }
        
        authenticationMethod = new AuthenticationChoiceSasl(
            decodeLdapString(root.valueBlock.value[2].valueBlock.value[0].valueBlock.valueHexView),
            root.valueBlock.value[2].valueBlock.value[1].valueBlock.valueHexView
        );
    } else {
        return undefined;
    }

    return {
        version: version,
        name: name,
        authentication: authenticationMethod
    };
}