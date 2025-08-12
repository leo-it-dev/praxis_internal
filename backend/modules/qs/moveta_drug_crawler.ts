import { DrugUnits, ReportableDrug } from "../../../api_common/api_qs";
import { getLogger } from "../../logger";
import path = require("node:path");
const { exec } = require('child_process');
const config = require('config');

const logger = getLogger('moveta-drug-crawler');

const movetaDrugUnitMapping = {
    "kg": DrugUnits.kilogram,
    "ml": DrugUnits.milliliter,
    "Inj.": DrugUnits.injector,
    "Fl.": undefined,
    "Pack.": undefined,
    "Stck": DrugUnits.injector,
    "Stck.": DrugUnits.injector,
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

function runMovetaSQLQueryCmdLineConvertToUTF8(query: string): Promise<row[]> {
    return new Promise((res, rej) => {
        const command = 'export LD_LIBRARY_PATH=$LD_LIBRARY_PATH:/opt/Unify/SQLBase; echo "' + escape(query) + '" | isql -c -d' + escape(COLUMN_DELIMITER) + ' -b ' + escape(config.get('movetaOdbcConnection.DRUGS_ODBC_MOVETA_DSN')) + ' | iconv -f ' + escape(SOURCE_CODING) + ' -t ' + escape(DEST_CODING);

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
            ],
            reportabilityVerifierMarkedErronous: false
        })
    };

    drugs = drugs.sort((drugA, drugB) => drugA.name.localeCompare(drugB.name));
    return drugs;
}

export async function readReportableDrugListFromMovetaDB(): Promise<Array<ReportableDrug>> {
    return new Promise((res, rej) => {
        runMovetaSQLQueryCmdLineConvertToUTF8InstallDbIfNeccessary("select ASUCH,ABEZ,AMEN,APCK,AZULASSUNG,APACKUNGSID from SYSADM.ARZNEIEN WHERE AZULASSUNG IS NOT NULL").then(rows => {
            let drugs = processRows(rows);
            res(drugs);
        }).catch(err => {
            rej(err);
        });
    });
}

async function movetaRunSQLAdministrativeCommands(commands: string[]): Promise<string> {
    return new Promise((res, rej) => {
        // final command example: 
        // cd /somepath; LD_LIBRARY_PATH=$LD_LIBRARY_PATH:/somepath; export LD_LIBRARY_PATH; ( echo "SET SERVER server1/PASS;"; echo "INSTALL DATABASE SOMEDBNAME;" ) | /somepath/sqllxtlk BAT DB=SBTASK/SYSADM/SYSADM;

        let dirpath = escape(path.dirname(config.get('movetaOdbcConnection.SQLLXTLK_BINARY_PATH')));
        commands = commands.map(c => 'echo "' + escape(c) + '"');
        let cmd1 = 'cd ' + dirpath + ';LD_LIBRARY_PATH="$LD_LIBRARY_PATH:' + dirpath + "\"; export LD_LIBRARY_PATH";
        let cmd2 = '( ' + commands.join(';') + ' )';
        let cmd3 = config.get('movetaOdbcConnection.SQLLXTLK_BINARY_PATH') + ' BAT DB=' + config.get('movetaOdbcConnection.DRUGS_SQLBASE_ADMIN_DATABASE') + '/' + config.get('movetaOdbcConnection.DRUGS_SQLBASE_ADMIN_USERNAME') + '/' + config.get('movetaOdbcConnection.DRUGS_SQLBASE_ADMIN_PASSWORD');
        
        let command = cmd1 + ';' + cmd2 + ' | ' + cmd3;
        exec(command, (err, stdout: string, stderr: string) => {
            if (err) {
                rej(err);
            } else {
                if (stderr == '') {
                    res(stdout + " " + stderr);
                } else {
                    rej(stderr + " " + stderr);
                }
            }
        });
    });
}

export async function installMovetaDBInSqlBaseServer(): Promise<void> {
    return new Promise((res, rej) => {
        let databaseName = config.get('movetaOdbcConnection.DRUGS_SQLBASE_WORKING_DATABASE');
        let serverName = config.get('movetaOdbcConnection.DRUGS_SQLBASE_SERVER_NAME');
        let password = config.get('movetaOdbcConnection.DRUGS_SQLBASE_SERVER_PASSWORD');

        let cmds = [
            'SET SERVER ' + escape(serverName) + '/' + escape(password) + ';',
            'INSTALL DATABASE ' + escape(databaseName) + ';'
        ]
        logger.info("Trying to install moveta database in SQL Server (make it available for network access)!", {database: databaseName});
        movetaRunSQLAdministrativeCommands(cmds).then(stdout => {
            if(stdout.includes("SERVER IS SET") && stdout.includes("DATABASE INSTALLED")) {
                logger.info("Successfully installed database " + databaseName + " for isql access!");
                res();
            } else {
                throw new Error("Invalid stdout from sqllxtlk subprocess: " + stdout);
            }
        }).catch(stderr => {
            logger.error("Error installing database for isql access!", {database: databaseName, error: stderr});
            rej();
        });
    });
}

async function runMovetaSQLQueryCmdLineConvertToUTF8InstallDbIfNeccessary(query: string): Promise<row[]> {
    return new Promise((res, rej) => {
        runMovetaSQLQueryCmdLineConvertToUTF8(query).then(rows => {
            res(rows);
        }).catch(err => {
            // There was an error reading from our moveta DB. Once possible option is that the Database got deinstalled from the server
            // after someone closed the moveta pegasus program. Let's try to reinstall the the database and reexecute the original query.
            installMovetaDBInSqlBaseServer().then(() => {
                // We were able to reinstall the database. Let's retry our original query.
                runMovetaSQLQueryCmdLineConvertToUTF8(query).then(rows => {
                    // Query worked now. Let's just return it and pretend nothing ever happened.
                    res(rows);
                }).catch((remountErr) => {
                    // Query still fails. There is something messed up seriously.
                    rej("Error reading from moveta db: " + err + " Could not fix error by reinstalling db: " + remountErr);
                });
            }).catch(() => {
                // There was an error reinstalling the database. Possibly connection error with database server.
                rej("Error reading from moveta db: " + err + " We could not reinstall the db, as we got an error doing so!");
            });
        });
    });
}
