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

export interface ApiInterfacePatchCustomerIn extends ApiModuleInterfaceF2B {
    customer: Customer
};
export interface ApiInterfacePatchBusinessIn extends ApiModuleInterfaceF2B {
    business: Business
};
export interface ApiInterfacePatchDrugIn extends ApiModuleInterfaceF2B {
    drug: Drug
};

export interface ApiInterfacePatchCustomerOut extends ApiModuleInterfaceB2F {
    customerReadback: Customer
};
export interface ApiInterfacePatchBusinessOut extends ApiModuleInterfaceB2F {
    businessReadback: Business
};
export interface ApiInterfacePatchDrugOut extends ApiModuleInterfaceB2F {
    drugReadback: Drug
};