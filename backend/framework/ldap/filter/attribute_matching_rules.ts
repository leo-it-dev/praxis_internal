import { caseIgnoreIA5Match, caseIgnoreIA5SubstringsMatch, caseIgnoreMatch, caseIgnoreSubstringsMatch, distinguishedNameMatch, presence, telephoneNumberMatch, telephoneNumberSubstringsMatch } from "./matching_rules";

// RFC4519 + RFC4524
export const ATTRIBUTE_MATCHING_LOOKUP = {
    dn: {
        equality: distinguishedNameMatch,
        substring: undefined,
        sup: undefined,
        presence: presence
    },
    name: {
        equality: caseIgnoreMatch,
        substring: caseIgnoreSubstringsMatch,
        sup: undefined,
        presence: presence
    },
    sn: {
        equality: undefined,
        substring: undefined,
        sup: 'name',
        presence: presence
    },
    cn: {
        equality: undefined,
        substring: undefined,
        sup: 'name',
        presence: presence
    },
    givenName: {
        equality: undefined,
        substring: undefined,
        sup: 'name',
        presence: presence
    },
    displayName: {
        equality: caseIgnoreMatch, // ??
        substring: undefined,
        sup: undefined,
        presence: presence
    },
    telephoneNumber: {
        equality: telephoneNumberMatch,
        substring: telephoneNumberSubstringsMatch,
        sup: undefined,
        presence: presence
    },
    mobile: {
        equality: telephoneNumberMatch,
        substring: telephoneNumberSubstringsMatch,
        sup: undefined,
        presence: presence
    },
    mail: {
        equality: caseIgnoreIA5Match,
        substring: caseIgnoreIA5SubstringsMatch,
        sup: undefined,
        presence: presence
    },
    street: {
        equality: caseIgnoreMatch,
        substring: caseIgnoreSubstringsMatch,
        sup: undefined,
        presence: presence
    },
    l: {
        equality: undefined,
        substring: undefined,
        sup: 'name',
        presence: presence
    },
    st: {
        equality: undefined,
        substring: undefined,
        sup: 'name',
        presence: presence
    },
    postalCode: {
        equality: caseIgnoreMatch,
        substring: caseIgnoreSubstringsMatch,
        sup: undefined,
        presence: presence
    },
    co: {
        equality: caseIgnoreMatch,
        substring: caseIgnoreSubstringsMatch,
        sup: undefined,
        presence: presence
    },
    description: {
        equality: caseIgnoreMatch,
        substring: caseIgnoreSubstringsMatch,
        sup: undefined,
        presence: presence
    },
}

export function resolveMatchingRule(attributeName: String) {
    let key = attributeName.toLowerCase();

    if (key in ATTRIBUTE_MATCHING_LOOKUP) {
        let equalityMatch = ATTRIBUTE_MATCHING_LOOKUP[key as keyof typeof ATTRIBUTE_MATCHING_LOOKUP];

        while (equalityMatch.sup) {
            key = equalityMatch.sup;
            equalityMatch = ATTRIBUTE_MATCHING_LOOKUP[key as keyof typeof ATTRIBUTE_MATCHING_LOOKUP];
        }

        return equalityMatch;
    }

    return undefined;
}