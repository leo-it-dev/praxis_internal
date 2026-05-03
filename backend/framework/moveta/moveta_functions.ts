import { Customer } from "../../../api_common/api_customer_ldap_mirror";
import { DrugUnits, ReportableDrug } from "../../../api_common/api_qs";
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

function processDrugRows(rows: row[]): ReportableDrug[] {
    let drugs: Array<ReportableDrug> = [];
    for (let row of rows) {
        drugs.push({
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
            reportabilityVerifierMarkedErronous: false
        })
    };

    drugs = drugs.sort((drugA, drugB) => drugA.name.localeCompare(drugB.name));
    return drugs;
}

function processCustomerRows(rows: row[]): Customer[] {
    let customers: Array<Customer> = [];
    for (let row of rows) {
        customers.push({
            firstName: row.KNAM1,
            givenName: row.KNAM2,
            search: row.KSUCH,
            street: row.KSTR,
            plz: parseInt(row.KPLZ),
            place: row.KORT,
            phone: row.KTEL,
            memo: row.KTEXT + " " + row.KMEMO,
            fax: row.KTELFAX,
            email: row.KEMAIL,
            birthday: new Date(row.KGEBDAT) || undefined
        })
    };

    customers = customers.sort((custA, custB) => custA.firstName.localeCompare(custB.firstName));
    return customers;
}

export async function readReportableDrugListFromMovetaDB(): Promise<Array<ReportableDrug>> {
    return new Promise((res, rej) => {
        runMovetaSQLQueryCmdLineConvertToUTF8InstallDbIfNeccessary("select ASUCH,ABEZ,AMEN,APCK,AZULASSUNG,APACKUNGSID from SYSADM.ARZNEIEN WHERE AZULASSUNG IS NOT NULL AND AHIDDEN=0").then(rows => {
            let drugs = processDrugRows(rows);
            res(drugs);
        }).catch(err => {
            rej(err);
        });
    });
}

export async function readCustomersFromMovetaDB(): Promise<Array<Customer>> {
    return new Promise((res, rej) => {
        runMovetaSQLQueryCmdLineConvertToUTF8InstallDbIfNeccessary("select KNAM1,KNAM2,KSUCH,KSTR,KPLZ,KORT,KTEL,KTEXT,KMEMO,KTELFAX,KEMAIL,KGEBDAT FROM SYSADM.KUNDEN WHERE KHIDDEN=0").then(rows => {
            let customers = processCustomerRows(rows);
            res(customers);
        }).catch(err => {
            rej(err);
        });
    });
}