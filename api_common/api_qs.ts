import { ApiModuleInterfaceB2F, ApiModuleInterfaceF2B } from "./backend_call";

export enum DrugUnitApi {
	GRAM = "GRAM",
	MILLILITER = "MILLILITER",
	INJECTOR = "INJECTOR",
	PILL = "PILL",
	BATON = "BATON",
	SPRAY = "SPRAY",
	KILOGRAM = "KILOGRAM",
	LITER = "LITER",
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
	liter: { id: DrugUnitApi.LITER, name: "Liter", abbrev: "l" }
};

export type DrugPackage = {
	package: string;
	pid: number;
	unitSuggestion: DrugUnit;
}

export type ReportableDrug = {
	znr: string;
	name: string;
	forms: Array<DrugPackage>;
	shortsearch: string | undefined;
};

export type Farmer = {
	name: string; // Eindeutige Identifikation des Tierhalters in VetProof
	locationNumber: string; // VVVO-Nummer des Tierhalters
	productionType: number[]; // Produktionsart laut QS
	qsNumber: string; // QS-Nummer des Tierhalters
	vpId: number; // Eindeutige Identifikation des Tierhalters in VetProof
};

export type PrescriptionRow = {
	animalGroup: number;
	animalCount: number;
	drugs: [
		{
			approvalNumber: string;
			packageId: number;
			amount: number;
			amountUnit: DrugUnitApi,
			applicationDuration: number;
		}
	];
}

export type DrugReport = {
	locationNumber: string; // VVVO-Nummer Farmer
	documentNumber: string; // Belegnummer
	deliveryDate: string; // Abgabedatum
	veterinary: string; // Nachname,Vorname Tierarzt
	prescriptionRows: PrescriptionRow[];
};

/* Api endpoints */
export interface ApiInterfaceDrugsOut   extends ApiModuleInterfaceB2F { prefered: ReportableDrug[]; fallback: ReportableDrug[] };
export interface ApiInterfaceFarmersOut extends ApiModuleInterfaceB2F { farmers: Farmer[] };
export interface ApiInterfacePutPrescriptionRowsIn extends ApiModuleInterfaceF2B { drugReport: DrugReport; cacheTillOnline: true};
