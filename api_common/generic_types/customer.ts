import { Chunk, CombinedEntity } from "./chunk"

export type MovetaCustomerChunk = Chunk & {
    // commonId: movetaCustomerId
    firstName: string // knam1
    givenName: string // knam2
    search: string, // ksuch
    street: string, // kstr
    plz: number | null, // kplz
    place: string, // kort
    phone: string | undefined, // ktel
    memo: string | undefined, // ktext + kmemo
    fax: string | undefined, // ktelfax
    email: string, // kemail
    birthday: Date | null // kgebdat
    uid: number // kid
}

export type IntranetCustomerChunk = Chunk & {
    changed: number,
    image: string | undefined;
    nonpaying: boolean;
    altgpsstreet: string | null;
    altgpsplz: number | null;
    altgpsplace: string | null;
}

export type Customer = CombinedEntity & MovetaCustomerChunk & IntranetCustomerChunk;
export const EMPTY_CUSTOMER: Customer = {
    commonId: "",
    changed: 0,
    altgpsplace: "",
    altgpsplz: null,
    altgpsstreet: "",
    email: "",
    fax: "",
    firstName: "",
    givenName: "",
    image: "",
    memo: "",
    nonpaying: false,
    phone: "",
    place: "",
    plz: 0,
    search: "",
    street: "",
    uid: 0,
    birthday: null
}