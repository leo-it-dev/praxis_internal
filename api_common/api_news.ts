import { ApiModuleInterfaceB2F, ApiModuleInterfaceF2B } from "./backend_call"

/* Api endpoint news */

export type News = {
    text: string,
    created: Date,
    creator: string,
    creatorSID: string,
    id: number
}

export interface ApiInterfaceNewsOut extends ApiModuleInterfaceB2F {
    simpleNews: News[]
};

export interface ApiInterfacePostNewsIn extends ApiModuleInterfaceF2B {
    message: string
};

export interface ApiInterfaceDropNewsIn extends ApiModuleInterfaceF2B {
    newsID: number
};
