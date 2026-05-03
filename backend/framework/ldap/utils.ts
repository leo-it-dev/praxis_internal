export function decodeLdapString(buffer: Uint8Array): string {
    return new TextDecoder("UTF-8").decode(buffer.buffer.slice(buffer.byteOffset, buffer.byteOffset + buffer.byteLength));
}
export function encodeLdapString(text: string): Uint8Array {
    return new TextEncoder().encode(text);
}

export function optional<T>(value: T | undefined, builder: (v: T) => any) {
    return value ? [builder(value)] : [];
}

export enum TagClass {
    APPLICATION = 2,
    CONTEXT_SPECIFIC = 3
}

export type AttributeValueAssertion = {
    attributeDesc: string,
    assertionValue: Uint8Array
}

export class OctetString {
    constructor(public bytes: Uint8Array) { }

    toString() {
        return decodeLdapString(this.bytes);
    }

    [Symbol.toPrimitive](hint: string) {
        if (hint === "string") {
            return this.toString();
        }
        return this.bytes;
    }
}


export type RDN = Record<string, string[]>; // multi-valued RDN support

// Basic attribute type normalization (expand if needed)
const ATTR_ALIASES: Record<string, string> = {
    cn: "cn",
    commonname: "cn",
    ou: "ou",
    dc: "dc",
    o: "o",
    c: "c",
    uid: "uid",
};

// Normalize attribute type
function normalizeAttrType(attr: string): string {
    const key = attr.trim().toLowerCase();
    return ATTR_ALIASES[key] || key;
}

// Normalize attribute value (simplified per RFC)
function normalizeValue(val: string): string {
    return val
        .trim()
        .replace(/\s+/g, " ") // collapse spaces
        .toLowerCase();
}

// Split DN into RDN strings (handles escaped commas)
function splitDN(dn: string): string[] {
    const parts: string[] = [];
    let current = "";
    let escape = false;

    for (const char of dn) {
        if (escape) {
            current += char;
            escape = false;
        } else if (char === "\\") {
            escape = true;
        } else if (char === ",") {
            parts.push(current.trim());
            current = "";
        } else {
            current += char;
        }
    }

    if (current) parts.push(current.trim());
    return parts;
}

// Split multi-valued RDN (cn=John+uid=123)
function splitRDN(rdn: string): string[] {
    const parts: string[] = [];
    let current = "";
    let escape = false;

    for (const char of rdn) {
        if (escape) {
            current += char;
            escape = false;
        } else if (char === "\\") {
            escape = true;
        } else if (char === "+") {
            parts.push(current.trim());
            current = "";
        } else {
            current += char;
        }
    }

    if (current) parts.push(current.trim());
    return parts;
}

// Parse DN into structured RDN array
export function parseDN(dn: string): RDN[] {
    return splitDN(dn).map((rdnStr) => {
        const rdn: RDN = {};

        for (const part of splitRDN(rdnStr)) {
            const [attr, ...rest] = part.split("=");
            const value = rest.join("=");

            const normAttr = normalizeAttrType(attr);
            const normValue = normalizeValue(value);

            if (!rdn[normAttr]) {
                rdn[normAttr] = [];
            }

            rdn[normAttr].push(normValue);
        }

        // sort values inside multi-valued RDN
        for (const key of Object.keys(rdn)) {
            rdn[key].sort();
        }

        return rdn;
    });
}

// Compare two RDNs
export function compareRDN(a: RDN, b: RDN): boolean {
    const keysA = Object.keys(a).sort();
    const keysB = Object.keys(b).sort();

    if (keysA.length !== keysB.length) return false;

    for (let i = 0; i < keysA.length; i++) {
        if (keysA[i] !== keysB[i]) return false;

        const valsA = a[keysA[i]];
        const valsB = b[keysB[i]];

        if (valsA.length !== valsB.length) return false;

        for (let j = 0; j < valsA.length; j++) {
            if (valsA[j] !== valsB[j]) return false;
        }
    }

    return true;
}

export function escapeRegExp(str: string): string {
    return str.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}