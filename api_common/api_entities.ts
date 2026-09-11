import { ApiModuleInterfaceB2F, ApiModuleInterfaceF2B } from "./backend_call"
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

export interface ApiInterfacePatchGenericOut {
    mergeConflict: boolean;
}

export interface ApiInterfacePatchCustomerIn extends ApiModuleInterfaceF2B {
    customer: Customer
    forcePush: boolean
};
export interface ApiInterfacePatchBusinessIn extends ApiModuleInterfaceF2B {
    business: Business
    forcePush: boolean
};
export interface ApiInterfacePatchDrugIn extends ApiModuleInterfaceF2B {
    drug: Drug
    forcePush: boolean
};

export interface ApiInterfacePatchCustomerOut extends ApiModuleInterfaceB2F, ApiInterfacePatchGenericOut {
    customerReadback: Customer;
};
export interface ApiInterfacePatchBusinessOut extends ApiModuleInterfaceB2F, ApiInterfacePatchGenericOut {
    businessReadback: Business;
};
export interface ApiInterfacePatchDrugOut extends ApiModuleInterfaceB2F, ApiInterfacePatchGenericOut {
    drugReadback: Drug;
};