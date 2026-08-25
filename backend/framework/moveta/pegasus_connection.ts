import { getLogger } from "../../logger";
import path = require("node:path");
const { exec } = require('child_process');
const config = require('config');

const logger = getLogger('moveta-drug-crawler');

const SOURCE_CODING = 'CP1252';
const DEST_CODING = 'UTF8';
const LINE_SEP_SQL = "@CHAR(1)";
const LINE_SEP_TEXT = '\x01';
const COLUMN_DELIMITER = '^';

export type row = {
    [key: string]: any
};

/**
 * @param str String to escape for subprocess creation
 * @returns str with each single quote escaped
 */
function escape(str: string): string {
    return str.replace("\"", '\\"');
}

/**
 * Converts german special characters into sqlbase understandable syntax.
 * Everything about this sqlbase database is shit.
 * It doesn't have native utf-8 support, isql can't correctly encode bytes and sqllxtlk would understand
 * utf-8 characters but is too dump to produce any machine parsable output.
 * SQLBase is a big piece of shit, newer versions are not supported by pegasus here we are writing
 * converting string functions to manually build a query string for a simple select statement in 2026.
 */
function escapeGermanSpecialChars(rawSql: string) {
    const replacementMap: Record<string, string> = {
        'Ä': "' || @CHAR(196) || '",
        'Ö': "' || @CHAR(214) || '",
        'Ü': "' || @CHAR(220) || '",
        'ä': "' || @CHAR(228) || '",
        'ö': "' || @CHAR(246) || '",
        'ü': "' || @CHAR(252) || '",
        'ß': "' || @CHAR(223) || '"
    };

    return rawSql.replace(/[ÄÖÜäöüß]/g, match => replacementMap[match]);
}

export function runMovetaSQLQueryCmdLineConvertToUTF8(query: string): Promise<row[]> {
    return new Promise((res, rej) => {

        if (!query.toLocaleLowerCase().startsWith("select")) {
            rej("runMovetasSQLQueryCmdLineConverToUTF8 only processes SQL Queries (SELECT)!");
            return;
        }

        let queryParts = query.split(" ");
        queryParts[1] = LINE_SEP_SQL + "," + queryParts[1]; // some columns may contain newlines. Therefore we can't just split stdout at newlines
                                                            // so for each returned row, we artificially select char code 1 (which noone could ever write on a normal keyboard)
                                                            // and split by that afterwards.
        query = queryParts.join(' ');
        query = escapeGermanSpecialChars(query);

        // odbc module is buggy and has 32bit / 64bin compability problems.
        let command = 'export LD_LIBRARY_PATH=$LD_LIBRARY_PATH:/opt/Unify/SQLBase; echo "' + escape(query) + '" | isql -c -d' + escape(COLUMN_DELIMITER) + ' -b ' + escape(config.get('movetaOdbcConnection.DRUGS_ODBC_MOVETA_DSN')) + ' | iconv -f ' + escape(SOURCE_CODING) + ' -t ' + escape(DEST_CODING);

        exec(command, (err: any, stdout: string, stderr: string) => {
            if (err) {
                rej(err);
            } else {
                if (stderr == '') {
                    let columnRow = stdout.split("\n")[0];
                    let columnNames = columnRow.split(COLUMN_DELIMITER);
                    columnNames.splice(0, 1); // delete column name '@CHAR(1)' we artificially added.
                    
                    let rowsStr = stdout.substring(stdout.indexOf('\n')+1).split(LINE_SEP_TEXT).map(row => row.substring(0, row.length - 1)); // split at '@CHAR(1)', delete trailing \n of each line.
                    let rowsArray = rowsStr.filter(row => row.trim() != '').map(row => row.split(COLUMN_DELIMITER).slice(1));
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

export async function movetaRunSQLAdministrativeCommands(commands: string[]): Promise<string> {
    return new Promise((res, rej) => {
        // final command example: 
        // cd /somepath; LD_LIBRARY_PATH=$LD_LIBRARY_PATH:/somepath; export LD_LIBRARY_PATH; ( echo "SET SERVER server1/PASS;"; echo "INSTALL DATABASE SOMEDBNAME;" ) | /somepath/sqllxtlk BAT DB=SBTASK/SYSADM/SYSADM;

        let dirpath = escape(path.dirname(config.get('movetaOdbcConnection.SQLLXTLK_BINARY_PATH')));
        commands = commands.map(c => 'echo "' + escape(c) + '"');
        let cmd1 = 'cd ' + dirpath + ';LD_LIBRARY_PATH="$LD_LIBRARY_PATH:' + dirpath + "\"; export LD_LIBRARY_PATH";
        let cmd2 = '( ' + commands.join(';') + ' )';
        let cmd3 = config.get('movetaOdbcConnection.SQLLXTLK_BINARY_PATH') + ' BAT DB=' + config.get('movetaOdbcConnection.DRUGS_SQLBASE_ADMIN_DATABASE') + '/' + config.get('movetaOdbcConnection.DRUGS_SQLBASE_ADMIN_USERNAME') + '/' + config.get('movetaOdbcConnection.DRUGS_SQLBASE_ADMIN_PASSWORD');

        let command = cmd1 + ';' + cmd2 + ' | ' + cmd3;
        exec(command, (err: any, stdout: string, stderr: string) => {
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
        logger.info("Trying to install moveta database in SQL Server (make it available for network access)!", { database: databaseName });
        movetaRunSQLAdministrativeCommands(cmds).then(stdout => {
            if (stdout.includes("SERVER IS SET") && stdout.includes("DATABASE INSTALLED")) {
                logger.info("Successfully installed database " + databaseName + " for isql access!");
                res();
            } else {
                throw new Error("Invalid stdout from sqllxtlk subprocess: " + stdout);
            }
        }).catch(stderr => {
            logger.error("Error installing database for isql access!", { database: databaseName, error: stderr });
            rej();
        });
    });
}

export async function runMovetaSQLQueryCmdLineConvertToUTF8InstallDbIfNeccessary(query: string): Promise<row[]> {
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
