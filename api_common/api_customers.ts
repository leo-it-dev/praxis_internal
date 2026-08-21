import { ApiModuleInterfaceB2F } from "./backend_call"
import { Business } from "./generic_types/business"
import { Customer } from "./generic_types/customer"
import { Drug } from "./generic_types/drug"

/* Api endpoint news */

export interface ApiInterfaceEntitiesListOut extends ApiModuleInterfaceB2F {
    customers: Customer[],
    businesses: Business[],
    drugs: Drug[],
    drugsExternal: Drug[]
};