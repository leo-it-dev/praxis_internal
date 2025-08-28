import { QsFarmerProductionCombination } from "./qs-farmer-production-combinations"; 

export type ProductionUsageGroup = {
    usageGroup: number;
    usageGroupName: string;
    reportRequired: boolean;
};

export abstract class QsFarmerAnimalAgeUsageGroup {

    static mappingBeef = {
        1: { // Rindermast
            1001: {name: "Mastrinder", reportRequired: true},
            1902: {name: "Mastrinder unter 12 Monate zugegangen", reportRequired: true},
            1903: {name: "Mastrinder unter 12 Monate eigene Aufzucht", reportRequired: true}
        },
        2: { // Kälbermast
            1002: {name: "Mastkälber", reportRequired: true} // Kein QS mitglied bei uns der Kälbermast macht. Evtl. gehören hier noch weitere Einträge rein!
        },
        4: { // Frässer-/Kälberaufzucht
            1004: {name: "Aufzuchtkälber", reportRequired: false}
        },
        8: { // Milchviehhaltung und Kälberaufzucht
            1004: {name: "Aufzuchtkälber", reportRequired: false},
            1708: {name: "Kälber Milchviehhaltung zugegangen", reportRequired: false},
            1008: {name: "Färsen", reportRequired: false},
            1804: {name: "Zuchtbullen", reportRequired: false},
            1808: {name: "Schlachtkühe", reportRequired: false},
            1908: {name: "Milchkühe", reportRequired: true}
        },
        16: { // Mutter-/Ammenkuhhaltung mit Kälbern
            1004: {name: "Aufzuchtkälber", reportRequired: false},
            1008: {name: "Färsen", reportRequired: false},
            1804: {name: "Zuchtbullen", reportRequired: false},
            1808: {name: "Schlachtkühe", reportRequired: false},
            1016: {name: "Mutterkühe", reportRequired: false}
        }
    };

    static mappingPork = {
        1: { // Schweinemast
            2001: {name: "Mastschweine", reportRequired: true},
        },
        2: { // Jungsauen- / Eberaufzucht
            2002: {name: "Jungsauen", reportRequired: true},
            2902: {name: "Jungeber", reportRequired: true},
            2802: {name: "Zuchtläufer bis 30 kg", reportRequired: true},
        },
        4: { // Sauenhaltung und Ferkel bis zum Absetzen
            2904: {name: "Sauen", reportRequired: true},
            2004: {name: "Saugferkel", reportRequired: true},
            2804: {name: "Eber", reportRequired: true}
        },
        8: { // Ferkelaufzucht
            2008: {name: "Aufzuchtferkel", reportRequired: true},
        }
    };

    static getUsageGroupsBasedOnProductionType(productionType: number): ProductionUsageGroup[] {
        let animalType = Math.floor(productionType / 1000) * 1000;
        let animalSpecificProductionType = productionType % 1000;

        let usageGroupLookup: {[key:number]:{[key:number]:{name: string, reportRequired: boolean}}} | undefined = undefined;
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
                    usageGroupsOut = Object.entries(usageGroups).map(usage => ({ usageGroup: parseInt(usage[0]), usageGroupName: usage[1].name, reportRequired: usage[1].reportRequired } as ProductionUsageGroup));
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