import { QsFarmerProductionCombination } from "./qs-farmer-production-combinations"; 

export type ProductionUsageGroup = {
    usageGroup: number;
    usageGroupName: string;
};

export abstract class QsFarmerAnimalAgeUsageGroup {

    static mappingBeef = {
        1: { // Rindermast
            1001: "Mastrinder",
            1902: "Mastrinder unter 12 Monate zugegangen",
            1903: "Mastrinder unter 12 Monate eigene Aufzucht"
        },
        2: { // Kälbermast
            1002: "Mastkälber" // Kein QS mitglied bei uns der Kälbermast macht. Evtl. gehören hier noch weitere Einträge rein!
        },
        4: { // Frässer-/Kälberaufzucht
            1004: "Aufzuchtkälber"
        },
        8: { // Milchviehhaltung und Kälberaufzucht
            1004: "Aufzuchtkälber",
            1708: "Kälber Milchviehhaltung zugegangen",
            1008: "Färsen",
            1804: "Zuchtbullen",
            1808: "Schlachtkühe",
            1908: "Milchkühe"
        },
        16: { // Mutter-/Ammenkuhhaltung mit Kälbern
            1004: "Aufzuchtkälber",
            1008: "Färsen",
            1804: "Zuchtbullen",
            1808: "Schlachtkühe",
            1016: "Mutterkühe"
        }
    };

    static mappingPork = {
        1: { // Schweinemast
            2001: "Mastschweine"
        },
        2: { // Jungsauen- / Eberaufzucht
            2002: "Jungsauen",
            2902: "Jungeber",
            2802: "Zuchtläufer bis 30 kg"
        },
        4: { // Sauenhaltung und Ferkel bis zum Absetzen
            2904: "Sauen",
            2004: "Saugferkel",
            2804: "Eber"
        },
        8: { // Ferkelaufzucht
            2008: "Aufzuchtferkel"
        }
    };

    static getUsageGroupsBasedOnProductionType(productionType: number): ProductionUsageGroup[] {
        let animalType = Math.floor(productionType / 1000) * 1000;
        let animalSpecificProductionType = productionType % 1000;

        let usageGroupLookup: {[key:number]:{[key:number]:string}} | undefined = undefined;
        let usageGroupBase = 0;

        let usageGroupsOut: ProductionUsageGroup[] = [];
        switch(animalType) {
            case QsFarmerProductionCombination.PRODUCTION_IDS_BEEF_BASE:
                usageGroupLookup = this.mappingBeef;
                usageGroupBase = QsFarmerProductionCombination.PRODUCTION_IDS_BEEF_BASE;
                break;
            case QsFarmerProductionCombination.PRODUCTION_IDS_PORK_BASE:
                usageGroupLookup = this.mappingPork;
                usageGroupBase = QsFarmerProductionCombination.PRODUCTION_IDS_PORK_BASE;
                break;
            default:
                console.error("(getUsageGroupsBasedOnProductionType) Production ID " + productionType + " does not belog to Beef or pork! We only support those at the moment!");
                break;
        }

        if (usageGroupLookup !== undefined) {
            for (let bitUsageGroupsPair of Object.entries(usageGroupLookup)) {
                let mask = parseInt(bitUsageGroupsPair[0]);
                let usageGroups = bitUsageGroupsPair[1];
                if (animalSpecificProductionType == mask) {
                    usageGroupsOut = Object.entries(usageGroups).map(usage => ({ usageGroup: parseInt(usage[0]), usageGroupName: usage[1] } as ProductionUsageGroup));
                    break;
                }
            }
        }
        return usageGroupsOut;
    }

    static getProductionTypeBasedOnUsageGroup(usageGroup: number): number {
        let animalTypeInt = Math.floor(usageGroup / 1000) * 1000;
        let animalTypes = [QsFarmerAnimalAgeUsageGroup.mappingBeef, QsFarmerAnimalAgeUsageGroup.mappingPork];
        for(let animalType of animalTypes) {
            for(let [productionType, specUsageGroups] of Object.entries(animalType)) {
                if (Object.keys(specUsageGroups).includes(String(usageGroup))) {
                    return animalTypeInt + parseInt(productionType);
                }
            }
        }
        return -1;
    }
}