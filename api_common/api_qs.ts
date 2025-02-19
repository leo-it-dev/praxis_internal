import { ApiModuleInterface } from "./backend_call";

export type DrugUnit = {
	id: number;
	name: string;
	abbrev?: string;
}

export class DrugUnits {
	static gram = { id: 1, name: "Gramm", abbrev: "g" }
	static milliliter = { id: 2, name: "Milliliter", abbrev: "ml" }
	static injector = { id: 3, name: "Injektor" }
	static tablet = { id: 4, name: "Tablette" }
	static stick = { id: 5, name: "Stab" }
	static spray = { id: 6, name: "Spraydose" }
	static kilogram = { id: 11, name: "Kilogramm", abbrev: "kg" }
	static liter = { id: 12, name: "Liter", abbrev: "l" }

	static values() {
		return [DrugUnits.gram,
		DrugUnits.milliliter,
		DrugUnits.injector,
		DrugUnits.tablet,
		DrugUnits.stick,
		DrugUnits.spray,
		DrugUnits.kilogram,
		DrugUnits.liter]
	}
}

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



/* Api endpoints */
// drugs
export interface ApiInterfaceDrugs   extends ApiModuleInterface { prefered: ReportableDrug[]; fallback: ReportableDrug[] }
export interface ApiInterfaceFarmers extends ApiModuleInterface { farmers: Farmer[] };
export interface ApiInterfacePing    extends ApiModuleInterface {};
export interface ApiInterfaceAuth    extends ApiModuleInterface {};