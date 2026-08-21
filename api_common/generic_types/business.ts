import { Chunk, CombinedEntity } from "./chunk";

export type MovetaBusinessChunk = Chunk & {
    commonId: string,
    customerMovetaId: string;
    businessType: string;
    vvvo: string;
}

export type IntranetBusinessChunk = Chunk & {
    dummy: string
}

export type Business = CombinedEntity & {
    moveta: MovetaBusinessChunk
    intranet: IntranetBusinessChunk
}