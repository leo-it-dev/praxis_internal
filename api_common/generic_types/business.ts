import { Chunk, CombinedEntity } from "./chunk";

export type MovetaBusinessChunk = Chunk & {
    commonId: string,
    customerMovetaId: string;
    businessType: string;
    vvvo: string;
}

export type IntranetBusinessChunk = Chunk & {
    changed: number,
    dummy: string
}

export type Business = CombinedEntity & MovetaBusinessChunk & IntranetBusinessChunk;

export const EMPTY_BUSINESS: Business = {
    commonId: "",
    changed: 0,
    businessType: "",
    customerMovetaId: "",
    dummy: "",
    vvvo: ""
}