// const util = require('util')
let xlsx = require('js-xlsx');

type DrugPackage = {
    content: string;
    package: string;
}

export type ReportableDrug = {
    znr: string;
    name: string;
    forms: Array<DrugPackage>;
};

function parseReportableDrugsExcelBlob(blob): Array<ReportableDrug> {
    let workbook = xlsx.read(blob);
    let sheet_name_list = workbook.SheetNames;
    let xlData = xlsx.utils.sheet_to_json(workbook.Sheets[sheet_name_list[0]]);
    let outData: Array<ReportableDrug> = [];
    
    let lastZnr = "";
    let lastName = "";
    let drugListZnr: Array<DrugPackage> = [];
    for(let obj of xlData) {
        let znr = obj["Zulassungsnummer (ZNR)"];
        let drugname = obj["Arzneimittelname"];
    
        if (lastZnr != znr) {
            if (drugListZnr.length > 0) {
                outData.push({"znr": lastZnr, "name": drugname, 'forms': drugListZnr})
            }
            drugListZnr = [];
        }
    
        drugListZnr.push({
            "content": obj["Packungsmenge"],
            "package": obj["Packungsbeschreibung"]
        });
    
        lastZnr = znr
        lastName = drugname;
    }
    
    // TODO: Fix last entry being added wrongly
    outData.push({"znr": lastZnr, "name": lastName, 'forms': drugListZnr})
    return outData;
}

export async function readReportableDrugListFromBVL() {
    /*try {
        let dat = await fetch(options.DRUGS_XLSX_URL).then(dat => dat.arrayBuffer());
        return parseReportableDrugsExcelBlob(Buffer.from(dat));
    } catch(e) {
        return null;
    }*/
}
