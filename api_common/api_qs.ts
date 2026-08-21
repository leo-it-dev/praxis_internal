import { ApiModuleInterfaceB2F, ApiModuleInterfaceF2B } from "./backend_call";
import { Drug, DrugUnitApi } from "./generic_types/drug";

export type Farmer = {
	name: string; // Eindeutige Identifikation des Tierhalters in VetProof
	locationNumber: string; // VVVO-Nummer des Tierhalters
	productionType: number[]; // Produktionsart laut QS
	qsNumber: string; // QS-Nummer des Tierhalters
	vpId: number; // Eindeutige Identifikation des Tierhalters in VetProof
	additionalInfoHydrated: string; // Standort des Betriebs aus Moveta nachgeladen, oder memos etc. (falls vorhanden).
};

export type PrescriptionRow = {
	animalGroup: number;
	animalCount: number;
	drugs: [
		{
			approvalNumber: string;
			packageId: number;
			amount: number;
			amountUnit: DrugUnitApi;
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

export type DrugReportApiReadback = {
	amount: number,
	amountUnit: DrugUnitApi,
	animalCount: number,
	animalGroup: number,
	applicationDuration: number,
	criticalAntibiotics: boolean,
	deliveryDate: string,
	documentNumber: string,
	drugDisplayName: string,
	farmerDisplayName: string,
	id: string,
	locationNumber: string,
	packageId: number,
	productionType: number,
	veterinary: string,
	veterinaryBnrHit: string,
};
export function castReportReadbackFromVeterinaryDocumentData(vetDocumentData: any): DrugReportApiReadback {
	let ourDrugReportFormat: DrugReportApiReadback = {
		amount: vetDocumentData.amount,
		amountUnit: vetDocumentData.amountUnit,
		animalCount: vetDocumentData.animalCount,
		animalGroup: vetDocumentData.animalGroup,
		applicationDuration: vetDocumentData.applicationDuration,
		criticalAntibiotics: vetDocumentData.criticalAntibiotics,
		deliveryDate: vetDocumentData.deliveryDate,
		documentNumber: vetDocumentData.documentNumber,
		drugDisplayName: vetDocumentData.drugDisplayName,
		farmerDisplayName: vetDocumentData.farmerDisplayName,
		id: vetDocumentData.id,
		locationNumber: vetDocumentData.locationNumber,
		packageId: vetDocumentData.packageId,
		productionType: vetDocumentData.productionType,
		veterinary: vetDocumentData.veterinary,
		veterinaryBnrHit: vetDocumentData.veterinaryBnrHit
	};
	return ourDrugReportFormat;
}

/* Api endpoints */
export interface ApiInterfaceDrugsOut   extends ApiModuleInterfaceB2F { prefered: Drug[]; fallback: Drug[] };
export interface ApiInterfaceFarmersOut extends ApiModuleInterfaceB2F { farmers: Farmer[] };
export interface ApiInterfacePutPrescriptionRowsIn extends ApiModuleInterfaceF2B { drugReport: DrugReport; cacheTillOnline: true};
