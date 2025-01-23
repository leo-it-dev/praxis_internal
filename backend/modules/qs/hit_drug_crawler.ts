// const util = require('util')
let xlsx = require('js-xlsx');
import {options} from "../../options";

type DrugPackage = {
    content: number;
    package: string;
}

export type ReportableDrug = {
    znr: string;
    name: string;
    forms: Array<DrugPackage>;
};

function parseSimpleDate(dateStr: string): Date {
    let parts = dateStr.split(".");
    if (parts.length !== 3) {
        console.error("Error parsing simple date! Not exactly three parts to date!");
        return new Date(0);
    }
    return new Date(parseInt(parts[2]), parseInt(parts[1]) - 1, parseInt(parts[0]));
}

function compare(a: number, b: number): number {
    if ( a > b ) {
        return 1;
    }
    if ( b > a ) {
        return -1;
    }
    return 0;
}

function parseReportableDrugsCSV(lines: Array<String>): Array<ReportableDrug> {
    let reportableDrugs: Array<ReportableDrug> = [];
    
    // Parse CSV file
    let headers = lines[0].split(";");
    let valpairs = lines.slice(1);
    
    // Extract headers
    let idxZnr = headers.indexOf("TAMA_ZNR");   // Official identifier of the drug
    let idxName = headers.indexOf("TAMA_NAME"); // Name of the drug
    let idxPack = headers.indexOf("TAMA_PBE");  // Name of the packaging, Packaging amount
    let idxEnr = headers.indexOf("TAMA_ENR");   // Internal primary key of the drug inside of the database
    let idxPid = headers.indexOf("TAMA_PID");   // Identifies each packaging type of one specific drug inside the database
    let idxPg = headers.indexOf("TAMA_PG");     // Packaging amount (total amount of drugs packed in one distributed package. Result of OP(...) inside TAMA_PBE)
    let idxVon = headers.indexOf("TAMA_VON");   // When was this drug licensed? Date format: dd.mm.yyyy
    let idxUpd = headers.indexOf("TAMA_UPD");   // UPD registration UUID (identifies the drug, contains multiple ZNR which contain multiple PID)

    // Parse columns with correct types as object attributes
    let parsedVals = valpairs.map(line => {
        let values = line.split(";");
        return {
            znr: values[idxZnr].replace(/"/g, ""),
            name: values[idxName].replace(/"/g, ""),
            pack: values[idxPack].replace(/"/g, ""),
            pg: parseFloat(values[idxPg].replace(/"/g, "")),
            enr: parseInt(values[idxEnr].replace(/"/g, "")),
            pid: parseInt(values[idxPid].replace(/"/g, "")),
            von: parseSimpleDate(values[idxVon].replace(/"/g, "")),
            upd: values[idxUpd].replace(/"/g, "")
        };
    }); // Map the strings to parsed values

    // Sort the drugs based on UPD, then ZNR, then PID, then registration time
    parsedVals.sort((parsedA, parsedB) => {
        /*// the UPD is a UUID with the following format: xxxxxxxx-????-????-xxxx-xxxxxxxxxxxx
        // There is no publically available information about the format. Though VetProof groups similar UPDs
        // and allows similar UPDs to be used in one /veterinary-document document-number.
        // Therefore we must group ours too, to ensure efficient use of the API and simplified drug selection for the vets.
        // It looks like the parts with 'x' are equal for drugs grouped by VetProof.
        // The parts marked '?' propably encode information about the packaging. They may vary between grouped drugs.
        // Let's sort the druglist based on the 'x' portions before proceeding to ZNR, PID, and registration time.
        let relevantUPDportionA = parsedA.upd.substring(0, 8) + parsedA.upd.substring(19, 37);
        let relevantUPDportionB = parsedB.upd.substring(0, 8) + parsedB.upd.substring(19, 37);*/

        // let prio4 = relevantUPDportionA.localeCompare(relevantUPDportionB);     // Sort first by UPD
        let prio3 = parsedA.znr.localeCompare(parsedB.znr);                     // Then by ZNR
        let prio2 = compare(parsedA.pid, parsedB.pid);                          // After that by PID
        let prio1 = compare(parsedA.von.getTime(), parsedB.von.getTime());      // And lastly by registration date

        // if (prio4 != 0) return prio4;
        if (prio3 != 0) return prio3;
        if (prio2 != 0) return prio2;
        if (prio1 != 0) return prio1;
        return 0;
    });

    // There may be multiple lines with identical ZNR and PID! In this case the drug has been licensed again and the old registration is not valid anymore.
    // The only major difference between the registrations is TAMA_VON and additional data we don't parse. Therefore we need to remove all duplicates with identical ZNR and PID.
    // As we sorted the drugs with identical ZID and PID to follow each other with ascending registration date, we just delete the last line if we read the same ZID and PID again.
    let parsedValsRemovedDuplicates = [];
    let lastZnr = "";
    let lastPid = 0;
    for (let parsedDrug of parsedVals) {

        if (lastZnr == parsedDrug.znr && lastPid == parsedDrug.pid) {
            // The last added drug has the same ZNR and PID.
            // As we have sorted the list to ascending registration dates, we remove the last added drug and add the current one.
            // This removes the old registration of the same drug and replaces it with the new registration!
            let oldReg = parsedValsRemovedDuplicates.pop();
            if (oldReg.name !== parsedDrug.name || oldReg.pack !== parsedDrug.pack) {
                console.warn(" - Replaced old drug registration with new one, but details have changed which is unexpected: ", oldReg, parsedDrug);
            }
        }

        parsedValsRemovedDuplicates.push(parsedDrug);

        lastZnr = parsedDrug.znr;
        lastPid = parsedDrug.pid;
    }

    // TODO: Check if such weird cases like Aivlosin exist for Cattle/Beef certified drugs! 
    // TODO: Filter drugs not allowed for cattle, as we don't support any other types right now!
    // TODO: Implement the above!!


    // TODO: Implement!!



    // Now group same drugs with different packagings into a nested object
    lastZnr = "";
    let lastName = "";
    let drugListZnr: Array<DrugPackage> = [];
    for(let obj of parsedValsRemovedDuplicates) {
        if (lastZnr != obj.znr) {
            if (drugListZnr.length > 0) {
                reportableDrugs.push({"znr": lastZnr, "name": lastName, 'forms': drugListZnr})
            }
            drugListZnr = [];
        }
        
        drugListZnr.push({
            package: obj.pack,
            content: obj.pg,
        });
    
        lastZnr = obj.znr
        lastName = obj.name;
    }
    
    if (drugListZnr.length > 0) {
        reportableDrugs.push({"znr": lastZnr, "name": lastName, 'forms': drugListZnr})
    }

    // sort grouped drugs by name ascending
    reportableDrugs.sort((drugA, drugB) => drugA.name.localeCompare(drugB.name));

    // console.log(util.inspect(reportableDrugs, {showHidden: false, depth: null, colors: true}))
    return reportableDrugs;
}

export async function readReportableDrugListFromHIT(): Promise<Array<ReportableDrug>> {
    return new Promise((res, rej) => {
        fetch(options.DRUGS_CSV_URL_HIT, {}).then(dat => dat.arrayBuffer()).then(array => {
            let text = new TextDecoder('iso-8859-1');
            let lines = text.decode(array).split("\n").map(l => l.replace('\r', ''));
            lines = lines.filter(line => line.trim() != '');
            res(parseReportableDrugsCSV(lines));
        }).catch(e => {
            rej("Error fetching reportable drugs CSV list from HIT: " + e);
        });
    });
}
