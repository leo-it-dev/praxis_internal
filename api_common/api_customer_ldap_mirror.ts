import { UserPermissionList } from "./permission_types"


export type Customer = {
    firstName: string // knam1
    givenName: string // knam2
    search: string, // ksuch
    street: string, // kstr
    plz: number, // kplz
    place: string, // kort
    phone: string, // ktel
    memo: string, // ktext + kmemo
    fax: string, // ktelfax
    email: string, // kemail
    birthday?: Date // kgebdat
    uid: number // kid
}
