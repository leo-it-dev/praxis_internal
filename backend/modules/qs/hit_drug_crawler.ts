// const util = require('util')
let xlsx = require('js-xlsx');
import { compare, parseSimpleDate } from "../../utilities/utilities";
import { DrugPackage, ReportableDrug } from "../../../api_common/api_qs";
const config = require('config');

function parseReportableDrugsCSV(lines: Array<String>): Array<ReportableDrug> {
    let reportableDrugs: Array<ReportableDrug> = [];
    
    // Parse CSV file
    let headers = lines[0].split(";");
    let valpairs = lines.slice(1);
    
    // Extract headers
    let idxZnr = headers.indexOf("TAMA_ZNR");   // Official identifier of the drug
    let idxName = headers.indexOf("TAMA_NAME"); // Name of the drug
    let idxPack = headers.indexOf("TAMA_PBE");  // Name of the packaging, Packaging amount
    let idxPid = headers.indexOf("TAMA_PID");   // Identifies each packaging type of one specific drug inside the database
    let idxPg = headers.indexOf("TAMA_PG");     // Packaging amount (total amount of drugs packed in one distributed package. Result of OP(...) inside TAMA_PBE)
    let idxVon = headers.indexOf("TAMA_VON");   // When was this drug licensed? Date format: dd.mm.yyyy

    let idxCattle = headers.indexOf("TAMA_RIND"); // Is the drug allowed to be used on cattle
    let idxPork = headers.indexOf("TAMA_SCHW"); // Is the drug allowed to be used on pork

    // Parse columns with correct types as object attributes
    let parsedVals = valpairs.map(line => {
        let values = line.split(";");
        return {
            znr: values[idxZnr].replace(/"/g, ""),
            name: values[idxName].replace(/"/g, ""),
            pack: values[idxPack].replace(/"/g, ""),
            pg: parseFloat(values[idxPg].replace(/"/g, "")),
            pid: parseInt(values[idxPid].replace(/"/g, "")),
            von: parseSimpleDate(values[idxVon].replace(/"/g, "")),
            cattle: parseInt(values[idxCattle].replace(/"/g, "")),
            pork: parseInt(values[idxPork].replace(/"/g, "")),
        };
    }); // Map the strings to parsed values

    // Filter out those medications that are not allowed to be used on the type of animal qs is interested in.
    // let totalAmountDrugs = parsedVals.length;
    parsedVals = parsedVals.filter(v => v.cattle || v.pork);
    // let amountDrugsApplicableFiltered = totalAmountDrugs - parsedVals.length;

    // Sort the drugs based on ZNR, then PID, then registration time
    parsedVals.sort((parsedA, parsedB) => {
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

    // Now group same drugs with different packagings into a nested object
    lastZnr = "";
    let lastName = "";
    let drugListZnr: Array<DrugPackage> = [];
    for(let obj of parsedValsRemovedDuplicates) {
        if (lastZnr != obj.znr) {
            if (drugListZnr.length > 0) {
                reportableDrugs.push({znr: lastZnr, name: lastName, forms: drugListZnr, shortsearch: null})
            }
            drugListZnr = [];
        }
        
        drugListZnr.push({
            package: obj.pack + " - " + obj.pg,
            pid: obj.pid,
            unitSuggestion: undefined
        });
    
        lastZnr = obj.znr
        lastName = obj.name;
    }
    
    if (drugListZnr.length > 0) {
        reportableDrugs.push({znr: lastZnr, name: lastName, forms: drugListZnr, shortsearch: null})
    }

    // sort grouped drugs by name ascending
    reportableDrugs.sort((drugA, drugB) => drugA.name.localeCompare(drugB.name));

    // console.log(util.inspect(reportableDrugs, {showHidden: false, depth: null, colors: true}))
    return reportableDrugs;
}

export async function readReportableDrugListFromHIT(): Promise<Array<ReportableDrug>> {
    return new Promise((res, rej) => {
        fetch(config.get('generic.DRUGS_CSV_URL_HIT'), {}).then(dat => dat.arrayBuffer()).then(array => {
            let text = new TextDecoder('iso-8859-1');
            let lines = text.decode(array).split("\n").map(l => l.replace('\r', ''));
            lines = lines.filter(line => line.trim() != '');
            res(parseReportableDrugsCSV(lines));
        }).catch(e => {
            rej("Error fetching reportable drugs CSV list from HIT: " + e);
        });
    });
}
