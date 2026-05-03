import { encodeLdapString, OctetString } from "./utils";

export type LdapAttribute = {
    type: OctetString,
    vals: OctetString[]
};

export class LdapEntry {
    constructor(
        public objectNameDN: OctetString,
        public attributes: LdapAttribute[]
    ) {}

    getAttribute(attributeName: string): LdapAttribute | undefined {
        return this.attributes.find(a => a.type.toString().toLowerCase() == attributeName.toLowerCase());
    }
}

export function constructLdapEntry(dn: string, attributes: {attr: string, vals: (string|Uint8Array)[]}[]) {
    return new LdapEntry(
        new OctetString(encodeLdapString(dn)),
        attributes.map(a => {
            return {
                type: new OctetString(encodeLdapString(a.attr)),
                vals: a.vals.map(v => new OctetString((v instanceof Uint8Array) ? v : encodeLdapString(v))),
            } as LdapAttribute;
        })
    )
}

export class LdapStore {

    private entries: LdapEntry[] = [];

    public storeEntry(entry: LdapEntry) {
        this.entries.push(entry);
    }

    public removeEntry(entry: LdapEntry) {
        this.entries = this.entries.filter(f => f != entry);
    }

    public getAllEntries() {
        return this.entries;
    }

    public replace(entries: LdapEntry[]) {
        this.entries = entries;
    }
}