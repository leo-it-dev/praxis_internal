import { MovetaBusinessChunk } from "../../../api_common/generic_types/business";
import { MovetaCustomerChunk } from "../../../api_common/generic_types/customer";
import { DrugUnits, MovetaDrugChunk } from "../../../api_common/generic_types/drug";
import { row, runMovetaSQLQueryCmdLineConvertToUTF8InstallDbIfNeccessary } from "./pegasus_connection";

const movetaDrugUnitMapping = {
    "kg": DrugUnits.kilogram,
    "ml": DrugUnits.milliliter,
    "Inj.": DrugUnits.injector,
    "Fl.": undefined,
    "Pack.": undefined,
    "Stck": DrugUnits.piece,
    "Stck.": DrugUnits.piece,
    "Tabl.": DrugUnits.baton,
    "g": DrugUnits.gram,
    "Tube": undefined,
};

function parseDrugUnitIfPossible(movetaUnit: string) {
    return movetaUnit in movetaDrugUnitMapping ? movetaDrugUnitMapping[movetaUnit as keyof typeof movetaDrugUnitMapping] : undefined;
}

function processDrugRows(rows: row[]): MovetaDrugChunk[] {
    let drugs: Array<MovetaDrugChunk> = [];
    for (let row of rows) {
        drugs.push({
            commonId: row.AKEN,
            znr: row.AZULASSUNG,
            name: row.ABEZ,
            shortsearch: row.ASUCH,
            forms: [
                {
                    package: row.AMEN + ' ' + row.APCK,
                    pid: parseInt(row.APACKUNGSID),
                    unitSuggestion: parseDrugUnitIfPossible(row.APCK)
                }
            ],
        })
    };

    drugs = drugs.sort((drugA, drugB) => drugA.name.localeCompare(drugB.name));
    return drugs;
}

function processBusinessRows(rows: row[]): MovetaBusinessChunk[] {
    let businesses: Array<MovetaBusinessChunk> = [];
    for (let row of rows) {
        businesses.push({
            commonId: row.BEKEN + row.BEVVVO,
            customerMovetaId: row.BEKKEN,
            businessType: row.BEBEZ,
            vvvo: row.BEVVVO
        });
    };

    businesses = businesses.sort((businessA, businessB) => businessA.commonId.localeCompare(businessB.commonId));
    return businesses;
}

function processCustomerRows(rows: row[]): MovetaCustomerChunk[] {
    let customers: Array<MovetaCustomerChunk> = [];
    for (let row of rows) {
        customers.push({
            firstName: row.KNAM1,
            givenName: row.KNAM2,
            search: row.KSUCH,
            street: row.KSTR,
            plz: parseInt(row.KPLZ),
            place: row.KORT,
            phone: row.KTEL,
            memo: row.KMEMO,
            fax: row.KTELFAX,
            email: row.KEMAIL,
            birthday: new Date(row.KGEBDAT) || undefined,
            uid: row.KNR,
            commonId: row.KKEN1
        })
    };

    customers = customers.sort((custA, custB) => custA.firstName.localeCompare(custB.firstName));
    return customers;
}

export async function readBusinessesFromMovetaDB(): Promise<Array<MovetaBusinessChunk>> {
    return new Promise((res, rej) => {
        runMovetaSQLQueryCmdLineConvertToUTF8InstallDbIfNeccessary("select BEKKEN,BEKEN,BEBEZ,BEVVVO,BEHIDDEN from SYSADM.BETRIEBE WHERE BEHIDDEN=0 OR BEHIDDEN IS NULL").then(rows => {
            let businesses = processBusinessRows(rows);
            res(businesses);
        }).catch(err => {
            rej(err);
        });
    });
}

export async function readReportableDrugListFromMovetaDB(): Promise<Array<MovetaDrugChunk>> {
    return new Promise((res, rej) => {
        runMovetaSQLQueryCmdLineConvertToUTF8InstallDbIfNeccessary("select AKEN,ASUCH,ABEZ,AMEN,APCK,AZULASSUNG,APACKUNGSID from SYSADM.ARZNEIEN WHERE AZULASSUNG IS NOT NULL AND AHIDDEN=0").then(rows => {
            let drugs = processDrugRows(rows);
            res(drugs);
        }).catch(err => {
            rej(err);
        });
    });
}

export async function readCustomersFromMovetaDB(): Promise<Array<MovetaCustomerChunk>> {
    return new Promise((res, rej) => {
        runMovetaSQLQueryCmdLineConvertToUTF8InstallDbIfNeccessary("select KKEN1,KNR,KNAM1,KNAM2,KSUCH,KSTR,KPLZ,KORT,KTEL,KTEXT,KMEMO,KTELFAX,KEMAIL,KGEBDAT FROM SYSADM.KUNDEN WHERE KHIDDEN=0 OR KHIDDEN IS NULL").then(rows => {
            let customers = processCustomerRows(rows);
            res(customers);
        }).catch(err => {
            rej(err);
        });
    });
}