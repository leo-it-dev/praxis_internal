import { options } from "../../options";
import { DrugUnits, ReportableDrug } from "../../../api_common/api_qs";
const { exec } = require('child_process');

const movetaDrugUnitMapping = {
    "kg": DrugUnits.kilogram,
    "ml": DrugUnits.milliliter,
    "Inj.": DrugUnits.injector,
    "Fl.": undefined,
    "Pack.": undefined,
    "Stck": undefined,
    "Stck.": undefined,
    "Tabl.": DrugUnits.baton,
    "g": DrugUnits.gram,
    "Tube": undefined,
};

const SOURCE_CODING = 'CP1252';
const DEST_CODING = 'UTF8';
const COLUMN_DELIMITER = '^';

type row = {
    [key: string]: string
};

/**
 * @param str String to escape for subprocess creation
 * @returns str with each single quote escaped
 */
function escape(str: string): string {
    return str.replace("'", "'\\''");
}

async function runMovetaSQLQueryCmdLineConvertToUTF8(query: string): Promise<row[]> {
    return new Promise((res, rej) => {
        const command = 'echo "' + escape(query) + '" | isql -c -d' + escape(COLUMN_DELIMITER) + ' -b ' + escape(options.DRUGS_ODBC_MOVETA_DSN) + 
            ' ' + escape(options.DRUGS_ODBC_MOVETA_UID) + 
            ' ' + escape(options.DRUGS_ODBC_MOVETA_PASS) + ' | iconv -f ' + escape(SOURCE_CODING) + ' -t ' + escape(DEST_CODING);

        exec(command, (err, stdout: string, stderr: string) => {
            if (err) {
                rej(err);
            } else {
                if (stderr == '') {
                    let rowsStr = stdout.split("\n");
                    let columnNames = rowsStr[0].split(COLUMN_DELIMITER);
                    let rowsArray = rowsStr.slice(1).filter(row => row.trim() != '').map(row => row.split(COLUMN_DELIMITER));
                    let rows: row[] = [];
                    for(const row of rowsArray) {
                        rows.push(Object.fromEntries(columnNames.map((e, i) => [e, row[i]])));
                    }
                    res(rows);
                } else {
                    rej(stderr);
                }
            }
        });
    });
}

function parseDrugUnitIfPossible(movetaUnit: string) {
    return movetaUnit in movetaDrugUnitMapping ? movetaDrugUnitMapping[movetaUnit] : undefined;
}

function processRows(rows: row[]): ReportableDrug[] {
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
            ]
        })
    };

    drugs = drugs.sort((drugA, drugB) => drugA.name.localeCompare(drugB.name));
    return drugs;
}

export async function readReportableDrugListFromMovetaDB(): Promise<Array<ReportableDrug>> {
    return new Promise((res, rej) => {
        runMovetaSQLQueryCmdLineConvertToUTF8("select ASUCH,ABEZ,AMEN,APCK,AZULASSUNG,APACKUNGSID from SYSADM.ARZNEIEN WHERE AZULASSUNG IS NOT NULL").then(rows => {
            let drugs = processRows(rows);
            res(drugs);
        }).catch(err => {
            rej(err);
        });
    });
}

/*export async function readReportableDrugListFromMovetaDB(): Promise<Array<ReportableDrug>> {
    return new Promise((res, rej) => {
        odbc.connect("DSN=" + options.DRUGS_ODBC_MOVETA_DSN +
            ";UID=" + options.DRUGS_ODBC_MOVETA_UID +
            ";PWD=" + options.DRUGS_ODBC_MOVETA_PASS, (error, conn) => {
                if (error) {
                    rej(error);
                } else {
                    conn.query('select ASUCH,ABEZ,AMEN,APCK,AZULASSUNG,APACKUNGSID'
                        + ' from SYSADM.ARZNEIEN '
                        + ' WHERE AZULASSUNG IS NOT NULL', (error, result) => {
                            if (error) {
                                rej(error);
                            }

                            let drugs = processRows(result);
                            res(drugs);
                        });
                }
            });
    });
}*/