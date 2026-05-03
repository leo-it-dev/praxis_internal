import * as asn1js from 'asn1js';
import { decodeLdapString, OctetString, TagClass } from '../utils';
import { Filter, FilterAnd, FilterApproxMatch, FilterEqualityMatch, FilterExtensibleMatch, FilterGreaterOrEqual, FilterLessOrEqual, FilterNot, FilterOr, FilterPresent, FilterSubstrings } from '../filter/filter';

export enum SearchRequestScope {
    baseObject = 0,
    singleLevel = 1,
    wholeSubtree = 2
}

export enum SearchRequestDerefAliases {
    neverDerefAliases = 0,
    derefInSearching = 1,
    derefFindingBaseObj = 2,
    derefAlways = 3
}

export type SearchRequest = {
    baseObject: OctetString,
    scope: SearchRequestScope,
    derefAliases: SearchRequestDerefAliases,
    sizeLimit: number,
    timeLimit: number,
    typesOnly: boolean,
    filter: Filter,
    attributes: string[]
}

function readFilter(obj: asn1js.BaseBlock): Filter | undefined {
    if (obj.idBlock.tagClass != TagClass.CONTEXT_SPECIFIC) {
        return undefined;
    }

    if (obj.idBlock.tagNumber == 0) { // AndFilter
        if (!(obj instanceof asn1js.Constructed)) {
            return undefined;
        }
        let filters = obj.valueBlock.value.map(v => readFilter(v));
        if (filters.some(f => f === undefined)) {
            return undefined;
        }
        return new FilterAnd(filters as Filter[]);
    }
    if (obj.idBlock.tagNumber == 1) { // OrFilter
        if (!(obj instanceof asn1js.Constructed)) {
            return undefined;
        }
        let filters = obj.valueBlock.value.map(v => readFilter(v));
        if (filters.some(f => f === undefined)) {
            return undefined;
        }
        return new FilterOr(filters as Filter[]);
    }
    if (obj.idBlock.tagNumber == 2) { // NotFilter
        if (!(obj instanceof asn1js.Constructed) || obj.valueBlock.value.length !== 1) {
            return undefined;
        }
        let filter = readFilter(obj.valueBlock.value[0]);
        if (filter === undefined) {
            return undefined;
        }
        return new FilterNot(filter);
    }
    if (obj.idBlock.tagNumber == 3) { // EqualityCheckFilter
        if (!(obj instanceof asn1js.Sequence)
            || !(obj.valueBlock.value[0] instanceof asn1js.OctetString)
            || !(obj.valueBlock.value[1] instanceof asn1js.OctetString)) {
                return undefined;
        }
        return new FilterEqualityMatch(
            {
                attributeDesc: decodeLdapString(obj.valueBlock.value[0].valueBlock.valueHexView),
                assertionValue: obj.valueBlock.value[1].valueBlock.valueHexView
            }
        );
    }
    if (obj.idBlock.tagNumber == 4) { // substringsFilter
        if (!(obj instanceof asn1js.Constructed)
            || !(obj.valueBlock.value[0] instanceof asn1js.OctetString)
            || !(obj.valueBlock.value[1] instanceof asn1js.Sequence)) {
            return undefined;
        }

        let type = decodeLdapString(obj.valueBlock.value[0].valueBlock.valueHexView);
        let substringsInitial: Uint8Array | undefined = undefined;
        let substringsAny = [];
        let substringsFinal: Uint8Array | undefined = undefined;

        for (let substring of obj.valueBlock.value[1].valueBlock.value) {
            if (!(substring instanceof asn1js.Primitive)) {
                return undefined;
            }
            if (substring.idBlock.tagClass != TagClass.CONTEXT_SPECIFIC) {
                return undefined;
            }
            if (substring.idBlock.tagNumber == 0) { // Initial
                if (substringsInitial != undefined) {
                    return undefined;
                }
                substringsInitial = substring.valueBlock.valueHexView;
            }
            if (substring.idBlock.tagNumber == 1) { // Any
                substringsAny.push(substring.valueBlock.valueHexView);
            }
            if (substring.idBlock.tagNumber == 2) { // Final
                if (substringsFinal != undefined) {
                    return undefined;
                }
                substringsFinal = substring.valueBlock.valueHexView;
            }
        }

        // shorthand version of 'present' filter
        if (substringsInitial === undefined && substringsFinal === undefined && substringsAny.length === 0) {
            return new FilterPresent(type)
        }

        if (!substringsInitial && substringsAny.length == 0 && !substringsFinal) {
            return undefined;
        }

        return new FilterSubstrings(
            type,
            {
                initial: substringsInitial ? new OctetString(substringsInitial) : undefined,
                any: substringsAny.map(s => new OctetString(s)),
                final: substringsFinal ? new OctetString(substringsFinal) : undefined
            }
        );
    }
    if (obj.idBlock.tagNumber == 5) { // greaterOrEqualFilter
        if (!(obj instanceof asn1js.Sequence)
            || !(obj.valueBlock.value[0] instanceof asn1js.OctetString)
            || !(obj.valueBlock.value[1] instanceof asn1js.OctetString)) {
                return undefined;
        }
        return new FilterGreaterOrEqual(
            {
                attributeDesc: decodeLdapString(obj.valueBlock.value[0].valueBlock.valueHexView),
                assertionValue: obj.valueBlock.value[1].valueBlock.valueHexView
            }
        );
    }
    if (obj.idBlock.tagNumber == 6) { // lessOrEqualFilter
        if (!(obj instanceof asn1js.Sequence)
            || !(obj.valueBlock.value[0] instanceof asn1js.OctetString)
            || !(obj.valueBlock.value[1] instanceof asn1js.OctetString)) {
                return undefined;
        }
        return new FilterLessOrEqual(
            {
                attributeDesc: decodeLdapString(obj.valueBlock.value[0].valueBlock.valueHexView),
                assertionValue: obj.valueBlock.value[1].valueBlock.valueHexView
            }
        );
    }
    if (obj.idBlock.tagNumber == 7) { // presentFilter
        if (!(obj instanceof asn1js.OctetString)) {
            return undefined;
        }
        return new FilterPresent(
            decodeLdapString(obj.valueBlock.valueHexView)
        )
    }
    if (obj.idBlock.tagNumber == 8) { // approxMatchFilter
        if (!(obj instanceof asn1js.Sequence)
            || !(obj.valueBlock.value[0] instanceof asn1js.OctetString)
            || !(obj.valueBlock.value[1] instanceof asn1js.OctetString)) {
                return undefined;
        }
        return new FilterApproxMatch(
            {
                attributeDesc: decodeLdapString(obj.valueBlock.value[0].valueBlock.valueHexView),
                assertionValue: obj.valueBlock.value[1].valueBlock.valueHexView
            }
        );
    }
    if (obj.idBlock.tagNumber == 9) { // extensibleMatchFilter
        if (!(obj instanceof asn1js.Constructed)) {
            return undefined;
        }
        let matchingRule: string | undefined = undefined;
        let type: string | undefined = undefined;
        let matchValue: Uint8Array | undefined = undefined;
        let dnAttributes = false;

        for (let assertion of obj.valueBlock.value) {
            if (assertion.idBlock.tagClass != TagClass.CONTEXT_SPECIFIC) {
                return undefined;
            }

            if (assertion.idBlock.tagNumber == 1) { // matchingRule
                if (!(assertion instanceof asn1js.OctetString) || matchingRule !== undefined) {
                    return undefined;
                }
                matchingRule = decodeLdapString(assertion.valueBlock.valueHexView);
            }
            if (assertion.idBlock.tagNumber == 2) { // type
                if (!(assertion instanceof asn1js.OctetString) || type !== undefined) {
                    return undefined;
                }
                type = decodeLdapString(assertion.valueBlock.valueHexView);
            }
            if (assertion.idBlock.tagNumber == 3) { // matchValue
                if (!(assertion instanceof asn1js.OctetString) || matchValue !== undefined) {
                    return undefined;
                }
                matchValue = assertion.valueBlock.valueHexView;
            }
            if (assertion.idBlock.tagNumber == 4) { // dnAttributes
                if (!(assertion instanceof asn1js.Boolean)) {
                    return undefined;
                }
                dnAttributes = assertion.valueBlock.value;
            }
        }

        if (matchValue == undefined) {
            return undefined;
        }
        return new FilterExtensibleMatch(
            new OctetString(matchValue),
            dnAttributes,
            matchingRule,
            type,
        );
    }
}

export function readSearchRequest(root: asn1js.Constructed): SearchRequest | undefined {
    if (root.valueBlock.value.length != 8) {
        return undefined;
    }

    if (!(root.valueBlock.value[0] instanceof asn1js.OctetString)) return undefined;
    if (!(root.valueBlock.value[1] instanceof asn1js.Enumerated) || SearchRequestScope[root.valueBlock.value[1].valueBlock.valueDec] === undefined) return undefined;
    if (!(root.valueBlock.value[2] instanceof asn1js.Enumerated) || SearchRequestDerefAliases[root.valueBlock.value[2].valueBlock.valueDec] === undefined) return undefined;
    if (!(root.valueBlock.value[3] instanceof asn1js.Integer)) return undefined;
    if (!(root.valueBlock.value[4] instanceof asn1js.Integer)) return undefined;
    if (!(root.valueBlock.value[5] instanceof asn1js.Boolean)) return undefined;
    if (!(root.valueBlock.value[6] instanceof asn1js.Constructed)) return undefined;
    if (!(root.valueBlock.value[7] instanceof asn1js.Sequence)) return undefined;
    if (root.valueBlock.value[7].valueBlock.value.find(v => !(v instanceof asn1js.OctetString))) return undefined;

    let baseObject = root.valueBlock.value[0].valueBlock.valueHexView;
    let scope = root.valueBlock.value[1].valueBlock.valueDec;
    let derefAlias = root.valueBlock.value[2].valueBlock.valueDec;
    let sizeLimit = root.valueBlock.value[3].valueBlock.valueDec;
    let timeLimit = root.valueBlock.value[4].valueBlock.valueDec;
    let typesOnly = root.valueBlock.value[5].valueBlock.value;
    let filter = readFilter(root.valueBlock.value[6]);
    let attributes = root.valueBlock.value[7].valueBlock.value.map(v => decodeLdapString((v as asn1js.OctetString).valueBlock.valueHexView))

    if (filter === undefined) {
        return undefined;
    }

    return {
        baseObject: new OctetString(baseObject),
        scope: scope,
        derefAliases: derefAlias,
        sizeLimit: sizeLimit,
        timeLimit: timeLimit,
        typesOnly: typesOnly,
        filter: filter,
        attributes: attributes
    } as SearchRequest;
}