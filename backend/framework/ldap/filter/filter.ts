import { LdapEntry } from "../ldap_store";
import { resolveMatchingRule } from "./attribute_matching_rules";
import { AttributeValueAssertion, OctetString } from "../utils";

export enum FilterResult {
    TRUE,
    FALSE,
    UNDEFINED
}

export interface Filter {};

export class FilterAnd implements Filter { constructor(public filters: Filter[]){} }
export class FilterOr implements Filter { constructor(public filters: Filter[]){} }
export class FilterNot implements Filter { constructor(public filter: Filter){} }
export class FilterEqualityMatch implements Filter { constructor(public equalityMatch: AttributeValueAssertion){} }
export class FilterSubstrings implements Filter {
    constructor(
        public type: string,
        public substrings: {
            initial?: OctetString,
            any: OctetString[],
            final?: OctetString
        }
    ){}
}
export class FilterGreaterOrEqual implements Filter { constructor(public greaterOrEqual: AttributeValueAssertion){} }
export class FilterLessOrEqual implements Filter { constructor(public lessOrEqual: AttributeValueAssertion){} }
export class FilterPresent implements Filter { constructor(public present: string){} }
export class FilterApproxMatch implements Filter { constructor(public approxMatch: AttributeValueAssertion){} }
export class FilterExtensibleMatch implements Filter { constructor(
    public matchValue: OctetString,
    public dnAttributes: boolean,
    public matchingRule?: string,
    public type?: string) {}
}

export function evaluateFilter(entry: LdapEntry, filter: Filter): FilterResult {
    if (filter instanceof FilterAnd) {
        let andResult = filter.filters.map(f => evaluateFilter(entry, f));
        if (andResult.every(f => f == FilterResult.TRUE)) {
            return FilterResult.TRUE;
        }
        if (andResult.some(f => f == FilterResult.FALSE)) {
            return FilterResult.FALSE;
        }
        return FilterResult.UNDEFINED;
    }
    if (filter instanceof FilterOr) {
        let orResult = filter.filters.map(f => evaluateFilter(entry, f));
        if (orResult.every(f => f == FilterResult.FALSE)) {
            return FilterResult.FALSE;
        }
        if (orResult.some(f => f == FilterResult.TRUE)) {
            return FilterResult.TRUE;
        }
        return FilterResult.UNDEFINED;
    }
    if (filter instanceof FilterNot) {
        let notResult = evaluateFilter(entry, filter.filter);
        if (notResult == FilterResult.TRUE) {
            return FilterResult.FALSE;
        }
        if (notResult == FilterResult.FALSE) {
            return FilterResult.TRUE;
        }
        return FilterResult.UNDEFINED;
    }

    if (filter instanceof FilterEqualityMatch) {
        let matching = resolveMatchingRule(filter.equalityMatch.attributeDesc);
        let attribute = entry.getAttribute(filter.equalityMatch.attributeDesc);

        if (matching === undefined || matching.equality === undefined || attribute === undefined) {
            return FilterResult.UNDEFINED;
        }

        const matches = attribute.vals.some(v => matching.equality(filter.equalityMatch.assertionValue, v.bytes));
        return matches ? FilterResult.TRUE : FilterResult.FALSE;
    }

    if (filter instanceof FilterSubstrings) {
        let matching = resolveMatchingRule(filter.type);
        let attribute = entry.getAttribute(filter.type);
        if (matching === undefined || matching.substring === undefined || attribute === undefined) {
            return FilterResult.UNDEFINED;
        }

        const matches = attribute.vals.some(v => matching.substring(v, filter.substrings.any, filter.substrings.initial, filter.substrings.final));
        return matches ? FilterResult.TRUE : FilterResult.FALSE;
    }

    if (filter instanceof FilterGreaterOrEqual) {
        // NOT Implemented yet
        return FilterResult.UNDEFINED;
    }
    if (filter instanceof FilterLessOrEqual) {
        // NOT Implemented yet
        return FilterResult.UNDEFINED;
    }
    if (filter instanceof FilterPresent) {
        let matching = resolveMatchingRule(filter.present);
        let attribute = entry.getAttribute(filter.present);
        if (matching === undefined || matching.presence === undefined || attribute === undefined) {
            return FilterResult.UNDEFINED;
        }

        const matches = attribute.vals.some(v => matching.presence(v));
        return matches ? FilterResult.TRUE : FilterResult.FALSE;
    }
    if (filter instanceof FilterApproxMatch) {
        // NOT Implemented yet
        return FilterResult.UNDEFINED;
    }
    if (filter instanceof FilterExtensibleMatch) {
        // NOT Implemented yet
        return FilterResult.UNDEFINED;
    }

    return FilterResult.UNDEFINED;
}