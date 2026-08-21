import { Chunk, CombinedEntity } from "./chunk";

export enum DrugUnitApi {
	GRAM = "GRAM",
	MILLILITER = "MILLILITER",
	INJECTOR = "INJECTOR",
	PILL = "PILL",
	BATON = "BATON",
	SPRAY = "SPRAY",
	KILOGRAM = "KILOGRAM",
	LITER = "LITER",
	PIECE = "PIECE",
}

export type DrugUnit = {
    id: DrugUnitApi;
    name: string;
    abbrev?: string;
}

export const DrugUnits = {
    gram: { id: DrugUnitApi.GRAM, name: "Gramm", abbrev: "g" },
    milliliter: { id: DrugUnitApi.MILLILITER, name: "Milliliter", abbrev: "ml" },
    injector: { id: DrugUnitApi.INJECTOR, name: "Injektor" },
    pill: { id: DrugUnitApi.PILL, name: "Tablette" },
    baton: { id: DrugUnitApi.BATON, name: "Stab" },
    spray: { id: DrugUnitApi.SPRAY, name: "Spraydose" },
    kilogram: { id: DrugUnitApi.KILOGRAM, name: "Kilogramm", abbrev: "kg" },
    liter: { id: DrugUnitApi.LITER, name: "Liter", abbrev: "l" },
    piece: { id: DrugUnitApi.PIECE, name: "Stück", abbrev: "st" }
};

export type DrugPackage = {
    package: string;
    pid: number;
    unitSuggestion?: DrugUnit;
}

export type MovetaDrugChunk = Chunk & {
    znr: string;
    name: string;
    forms: DrugPackage[];
    shortsearch: string | undefined;
}

export type HitDrugChunk = Chunk & {
    znr: string;
    name: string;
    forms: DrugPackage[];
}

export enum DrugVerifiedState {
    eVERIFIED_SUCCESSFULLY_REPORTABLE = 0,
    eVERIFIED_NOT_REPORTABLE = 1,
    eNOT_TESTED = 2,
}

export type IntranetDrugChunk = Chunk & {
    reportabilityVerifierMarkedErronous: DrugVerifiedState;
}

export type Drug = CombinedEntity & {
    moveta: MovetaDrugChunk;
    intranet: IntranetDrugChunk;
    hit: HitDrugChunk;
}
