import * as util from '../utils'

export function caseIgnoreMatch(assertion: Uint8Array, attributeVal: Uint8Array) {
    let assertionS = util.decodeLdapString(assertion).toLowerCase()
    let attributeValS = util.decodeLdapString(attributeVal).toLowerCase()

    assertionS = assertionS.trim().replaceAll(/\s+/g, " ")
    attributeValS = attributeValS.trim().replaceAll(/\s+/g, " ")

    return assertionS == attributeValS;
}

export function distinguishedNameMatch(assertion: Uint8Array, attributeVal: Uint8Array) {
    const dnA = util.parseDN(util.decodeLdapString(assertion));
    const dnB = util.parseDN(util.decodeLdapString(attributeVal));

    if (dnA.length !== dnB.length) return false;

    for (let i = 0; i < dnA.length; i++) {
        if (!util.compareRDN(dnA[i], dnB[i])) {
            return false;
        }
    }

    return true;
}

export function telephoneNumberMatch(assertion: Uint8Array, attributeVal: Uint8Array) {
    let assertionS = util.decodeLdapString(assertion).trim().replace(/[^0-9+]/g, "").replace(/(?!^)\+/g, "")
    let attributeValS = util.decodeLdapString(attributeVal).trim().replace(/[^0-9+]/g, "").replace(/(?!^)\+/g, "")
    return assertionS == attributeValS;
}

export function caseIgnoreIA5Match(assertion: Uint8Array, attributeVal: Uint8Array) {
    let assertionS = util.decodeLdapString(assertion).toLowerCase()
    let attributeValS = util.decodeLdapString(attributeVal).toLowerCase()

    assertionS = assertionS.trim().replaceAll(/\s+/g, " ")
    attributeValS = attributeValS.trim().replaceAll(/\s+/g, " ")

    return assertionS == attributeValS;
}

export function caseIgnoreSubstringsMatch(attributeVal: util.OctetString, parts: util.OctetString[], initial?: util.OctetString, end?: util.OctetString) {
    if (initial === undefined && end === undefined && parts.length == 0) {
        return false;
    }

    let attributeValS = attributeVal.toString().trim().replaceAll(/\s+/g, " ")

    let segments = []
    if (initial) {
        segments.push(util.escapeRegExp(initial.toString().trim().replaceAll(/\s+/g, " ")));
    }
    segments.push(...parts.map(p => util.escapeRegExp(p.toString().trim().replaceAll(/\s+/g, " "))))
    if (end) {
        segments.push(util.escapeRegExp(end.toString().trim().replaceAll(/\s+/g, " ")));
    }

    let pattern = "^";
    if (initial === undefined) {
        pattern += ".*";
    }
    pattern += segments.join(".*")
    if (end === undefined) {
        pattern += ".*";
    }
    pattern += "$";

    let regex = new RegExp(pattern, 'i');
    return regex.test(attributeValS);
}

export function telephoneNumberSubstringsMatch(attributeVal: util.OctetString, parts: util.OctetString[], initial?: util.OctetString, end?: util.OctetString) {
    if (initial === undefined && end === undefined && parts.length == 0) {
        return false;
    }

    let attributeValS = attributeVal.toString().trim().replace(/[^0-9+]/g, "").replace(/(?!^)\+/g, "")

    let segments = []
    if (initial) {
        segments.push(util.escapeRegExp(initial.toString().trim().replace(/[^0-9+]/g, "").replace(/(?!^)\+/g, "")));
    }
    segments.push(...parts.map(p => util.escapeRegExp(p.toString().trim().replace(/[^0-9+]/g, "").replace(/(?!^)\+/g, ""))))
    if (end) {
        segments.push(util.escapeRegExp(end.toString().trim().replace(/[^0-9+]/g, "").replace(/(?!^)\+/g, "")));
    }

    let pattern = "^";
    if (initial === undefined) {
        pattern += ".*";
    }
    pattern += segments.join(".*")
    if (end === undefined) {
        pattern += ".*";
    }
    pattern += "$";

    let regex = new RegExp(pattern, 'i');
    return regex.test(attributeValS);

}

export function caseIgnoreIA5SubstringsMatch(attributeVal: util.OctetString, parts: util.OctetString[], initial?: util.OctetString, end?: util.OctetString) {
    if (initial === undefined && end === undefined && parts.length == 0) {
        return false;
    }

    let attributeValS = attributeVal.toString().trim().replaceAll(/\s+/g, " ")

    let segments = []
    if (initial) {
        segments.push(util.escapeRegExp(initial.toString().trim().replaceAll(/\s+/g, " ")));
    }
    segments.push(...parts.map(p => util.escapeRegExp(p.toString().trim().replaceAll(/\s+/g, " "))))
    if (end) {
        segments.push(util.escapeRegExp(end.toString().trim().replaceAll(/\s+/g, " ")));
    }

    let pattern = "^";
    if (initial === undefined) {
        pattern += ".*";
    }
    pattern += segments.join(".*")
    if (end === undefined) {
        pattern += ".*";
    }
    pattern += "$";

    let regex = new RegExp(pattern, 'i');
    return regex.test(attributeValS);
}

export function presence(attributeVal: util.OctetString) {
    return attributeVal != undefined;
}