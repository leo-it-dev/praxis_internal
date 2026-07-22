import { UserPermissionList } from "./permission_types"


export type Customer = {
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
    movetaCustomerId: string; // kkenn1
}
