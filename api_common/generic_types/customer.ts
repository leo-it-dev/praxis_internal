import { Chunk, CombinedEntity } from "./chunk"

export type MovetaCustomerChunk = Chunk & {
    // commonId: movetaCustomerId
    firstName: string // knam1
    givenName: string // knam2
    search: string, // ksuch
    street: string, // kstr
    plz: number, // kplz
    place: string, // kort
    phone: string | undefined, // ktel
    memo: string | undefined, // ktext + kmemo
    fax: string | undefined, // ktelfax
    email: string, // kemail
    birthday?: Date // kgebdat
    uid: number // kid
}

export type IntranetCustomerChunk = Chunk & {
    image: string | undefined;
    nonpaying: boolean;
    altgpsstreet: string | undefined;
    altgpsplz: string | undefined;
    altgpsplace: string | undefined;
}

export type Customer = CombinedEntity & {
    moveta: MovetaCustomerChunk;
    intranet: IntranetCustomerChunk;
}
