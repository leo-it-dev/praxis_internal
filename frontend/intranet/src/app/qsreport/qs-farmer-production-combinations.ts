export type ApiCompatibleProductionType = {
    productionType: number;
    productionTypeName: string;
};

export abstract class QsFarmerProductionCombination {

    static PRODUCTION_IDS_BEEF_BASE = 1000; // CATTLE
    static PRODUCTION_IDS_PORK_BASE = 2000;

    private static productionIDsApiCompatibleBeef = {
        /*1001*/ 1: "Rindermast",
        /*1002*/ 2: "Kälbermast",
        /*1004*/ 4: "Fresser-/Kälberaufzucht",
        // /*1005*/ 5: "Fresser-/Kälberaufzucht + Rindermast", // This is allowed based on the API, but doesn't make much sense. Also 1005 is split up into 1001 and 1004 on the official page, so we do this the same way!
        /*1008*/ 8: "Milchviehhaltung und Kälberaufzucht",
        /*1016*/ 16: "Mutter-/Ammenkuhhaltung mit Kälbern",
        // following are pork and turkey. We don't care about these right now
    }

    private static productionIDsApiCompatiblePork = {
        /*1001*/ 1:	"Schweinemast",
        /*1002*/ 2:	"Jungsauen- / Eberaufzucht",
        /*1004*/ 4:	"Sauenhaltung und Ferkel bis zum Absetzen",
        /*1008*/ 8:	"Ferkelaufzucht"
        // 2009:	"Ferkelaufzucht + Schweinemast" // This is allowed based on the API, but doesn't make much sense.
    };

    private static productionIDCombinationsPossibleBeef = [
        // See documents/image2.png   These combinations are simply bitmasks of 1000 + multiple of productionIDsApiCompatibleBeef
        1002, 1003, 1004, 1005, 1006, 1007, 1008, 1009, 1010, 1011, 1012, 1013, 1014, 1015, 1016, 
        1018, 1019, 1020, 1021, 1022, 1023, 1024, 1025, 1026, 1027, 1028, 1029, 1030, 1031, 1320
    ];
    private static productionIDCombinationsPossiblePork = [
        2001, 2002, 2003, 2004, 2005, 2006, 2007, 2008, 2009, 2010, 2011, 2012, 2013, 2014, 2015
    ];
    
    static splitProductionIdIntoAPICompatibleIDs(genericId: number): ApiCompatibleProductionType[] {
        let animalType = Math.floor(genericId / 1000) * 1000;
        let animalSpecificBitmask = genericId % 1000;

        let allowedIDsLookup: number[] | undefined = undefined;
        let productionIDsLookup: {[key:number]:string} | undefined = undefined;
        let productionIDBase = 0;

        let possibleProductionIDs: ApiCompatibleProductionType[] = [];
        switch(animalType) {
            case this.PRODUCTION_IDS_BEEF_BASE:
                allowedIDsLookup = this.productionIDCombinationsPossibleBeef;
                productionIDsLookup = this.productionIDsApiCompatibleBeef;
                productionIDBase = this.PRODUCTION_IDS_BEEF_BASE;
                break;
            case this.PRODUCTION_IDS_PORK_BASE:
                allowedIDsLookup = this.productionIDCombinationsPossiblePork;
                productionIDsLookup = this.productionIDsApiCompatiblePork;
                productionIDBase = this.PRODUCTION_IDS_PORK_BASE;
                break;
            default:
                console.error("(splitProductionIdIntoAPICompatibleIDs) Production ID " + genericId + " does not belog to Beef or pork! We only support those at the moment!");
                break;
        }

        if (allowedIDsLookup !== undefined && productionIDsLookup !== undefined) {
            if (allowedIDsLookup.includes(genericId)) {
                for (let bitNamePair of Object.entries(productionIDsLookup)) {
                    let bitmask = parseInt(bitNamePair[0]);
                    let productionTypeName = bitNamePair[1];
                    if ((animalSpecificBitmask & bitmask) == bitmask) {
                        possibleProductionIDs.push({productionType: productionIDBase + bitmask, productionTypeName: productionTypeName});
                    }
                }
            }
        }

        return possibleProductionIDs;
    }
}