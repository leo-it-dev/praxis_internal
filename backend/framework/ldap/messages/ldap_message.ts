import * as asn1js from 'asn1js';

export enum ProtocolOpCode {
    bindRequest = 0,
    bindResponse = 1,
    unbindRequest = 2,
    searchRequest = 3,
    searchResultEntry = 4,
    searchResultReference = 19,
    searchResultDone = 5
}

export type LdapMessage = {
    messageID: number,
    protocolOp: asn1js.Constructed
}

export function buildLdapMessage(message: LdapMessage): asn1js.Sequence {
    return new asn1js.Sequence({
        value: [
            new asn1js.Integer({ value: message.messageID }),
            message.protocolOp
        ]
    });
}

export function readLdapMessage(baseBlock: asn1js.BaseBlock): LdapMessage | undefined {
    if (!(baseBlock instanceof asn1js.Constructed)) {
        return undefined;
    }

    let messageIdBlock = baseBlock.valueBlock.value[0];

    if (!(messageIdBlock instanceof asn1js.Integer)) {
        return undefined;
    }

    let messageID = messageIdBlock.valueBlock.valueDec;

    let opBlock = baseBlock.valueBlock.value[1];

    if (!(opBlock instanceof asn1js.Constructed) && !(opBlock instanceof asn1js.Primitive)) {
        return undefined;
    }

    let opBlockRes: asn1js.Constructed;

    if (opBlock instanceof asn1js.Primitive) {
        opBlockRes = new asn1js.Constructed({
            idBlock: {
                tagClass: opBlock.idBlock.tagClass,
                tagNumber: opBlock.idBlock.tagNumber,
            },
            value: []
        })
    } else {
        opBlockRes = opBlock;
    }

    return {
        messageID: messageID,
        protocolOp: opBlockRes
    }
}