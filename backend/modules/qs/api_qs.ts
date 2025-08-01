import { ApiModule } from '../../api_module';
import { Farmer, QsApiHandler } from './qsapi_handler';
import { readReportableDrugListFromMovetaDB } from './moveta_drug_crawler';
import { ApiInterfaceDrugsOut, ApiInterfaceFarmersOut, ApiInterfacePutPrescriptionRowsIn, ReportableDrug } from '../../../api_common/api_qs';
import { readReportableDrugListFromHIT } from './hit_drug_crawler';
import { sum } from '../../utilities/utilities';
import { ApiInterfaceEmptyIn, ApiInterfaceEmptyOut } from '../../../api_common/backend_call';
import { getApiModule } from '../../index';
import { ApiModuleLdapQuery } from '../ldapquery/api_ldapquery';
import { Mutex } from 'async-mutex';
const config = require('config');
import { performPatches } from '../../ext_config_patcher';
import * as fs from 'fs';

export class ApiModuleQs extends ApiModule {

    private qsApiHandler: QsApiHandler;
    private reportableDrugsPrefered: Array<ReportableDrug> = []; // List of drugs that *should* cover all drugs we use.
    private reportableDrugsFallback: Array<ReportableDrug> = []; // If there are drugs missing though, a vet may also use drugs from the fallback list.
    private farmers: Array<Farmer> = [];

    private updateDrugsMutex = new Mutex();
    private updateFarmersMutex = new Mutex();

    modname(): string {
        return "qs";
    }

    loginRequired(): boolean {
        return true;
    }

    initializeDrugSources() {
        performPatches([
            // /etc/odbc.ini and /opt/Unify/SQLBase/sql.ini contain placeholders as part of the installation process.
            // create a backup of the placeholder file variants and resolve all placeholders with the <movetaOdbcConnection> configuration section.
            {configurationBase: "movetaOdbcConnection", patchPaths: ["/etc/odbc.ini", "/opt/Unify/SQLBase/sql.ini"]}
        ]);
    }

    async updateDrugs() {
        const inst = this;
        console.log("Scheduled update of internal databases of reportable drugs...");

        this.initializeDrugSources();

        await this.updateDrugsMutex.acquire();
        let databases = [
            {logname: "Moveta", promise: readReportableDrugListFromMovetaDB(), store: (drugs) => inst.reportableDrugsPrefered = drugs},
            {logname: "HIT",    promise: readReportableDrugListFromHIT(),      store: (drugs) => inst.reportableDrugsFallback = drugs}
        ];

        Promise.allSettled(databases.map(d => d.promise)).then(drugs => {
            let logStr = "Read databases of reportable drugs: \n";
            databases.forEach((database, i) => {
                let drug = drugs[i];
                if (drug.status == "fulfilled") {
                    database.store(drug.value);
                    logStr += " - " + database.logname + ": " + drug.value.length + " Drugs / " + sum(drug.value.map(d => d.forms.length)) + " Packaging Forms\n";
                } else {
                    logStr += " - " + database.logname + ": error: " + drug.reason.trim("\n") + "\n";
                    console.error("Error receiving drug list from " + database.logname + " db: " + drug.reason.trim("\n"));
                }
            });
            this.updateDrugsMutex.release();
            console.log(logStr);
        });
    }

    async updateQsDatabase() {
        const inst = this;
        console.log("Scheduled update of internal database of QS informations...");

        await this.updateFarmersMutex.acquire();

        this.qsApiHandler.readFarmers().then(farmers => {
            inst.farmers = farmers;
            console.log("Successfully updated list of registered farmers: " + this.farmers.length + " entries!");
        }).catch(e => {
            console.error("Error updating internal database of registered farmers: ", e);
        }).finally(() => {
            this.updateFarmersMutex.release();
        });
    }

    async initialize() {
        this.qsApiHandler = new QsApiHandler();

        await this.qsApiHandler.renewAccessToken();

        try {
            let versionInformation = await this.qsApiHandler.requestVersionInformation();
            console.log("Detected Vetproof Gateway Version: " + versionInformation);
        } catch (e) {
            console.error("Error detecting Vetproof Gateway Version!: " + e);
        }

        setInterval(this.updateDrugs.bind(this), config.get('generic.DRUGS_CRAWLING_INTERVAL_DAYS') * 24 * 60 * 60 * 1000);
        this.updateDrugs();

        setInterval(this.updateQsDatabase.bind(this), config.get('generic.QS_DATABASE_CRAWL_UPDATE_INTERVAL_DAYS') * 24 * 60 * 60 * 1000);
        this.updateQsDatabase();


        // TODO: Remove
        /*let limit = 100;
        let offset = 0;

        let filePath = "/tmp/qs_dump.csv";
        let fileHandle = await fs.promises.open(filePath, 'w');

        let headerWritten = false;
        let headers = [];

        let drugs = new Set<string>();

        try {
            while (true) {
                console.log("a");
                
                let resOut = undefined;
                let prom = new Promise((res, rej) => {resOut = res;})
                setTimeout(() => resOut(), 100);
                await prom;

                let data = await this.qsApiHandler.requestDrugReports(limit, offset);
                // await this.qsApiHandler.requestSingleDrugReport(data.documents[0].id);

                for (let doc of data.documents) {
                    if (!headerWritten) {
                        headers = Object.keys(doc).map(e => e.toString());
                        fileHandle.writeFile(headers.join(';') + "\r\n");
                        headerWritten = true;
                    }

                    let serializeEntries = [];
                    for(let entry of headers) {
                        serializeEntries.push(doc[entry] || "-");
                    }
                    drugs.add(doc["drugDisplayName"]);
                    fileHandle.writeFile(serializeEntries.join(";") + "\r\n");
                }

                if (!data.moreData) {
                    console.log("Done reading all entries!");
                    fileHandle.close();
                    break;
                }

                offset += limit;
            }

            let found = 0;
            let notFound = 0;
            for (let drugDisplayName of Array.from(drugs)) {
                let foundCountPrimary = this.reportableDrugsPrefered.filter(d => d.name.toLowerCase() == drugDisplayName.toLowerCase()).length;
                let foundCountSecondary = this.reportableDrugsFallback.filter(d => d.name.toLowerCase() == drugDisplayName.toLowerCase()).length;
                console.log(Math.max(foundCountPrimary, foundCountSecondary) > 0 ? "+" : "-", drugDisplayName, foundCountPrimary, foundCountSecondary);
                if (Math.max(foundCountPrimary, foundCountSecondary) > 0) {
                    found++;
                } else {
                    notFound++;
                }
            }


            console.log("Found: ", found);
            console.log("Not found:", notFound);
            console.log("");
        } catch(er) {
            console.error(er);
        }*/
    }

    registerEndpoints() {
        this.get<ApiInterfaceEmptyIn, ApiInterfaceDrugsOut>("drugs", async (req, user) => {
            await this.updateDrugsMutex.waitForUnlock();
            return { statusCode: 200, responseObject: {prefered: this.reportableDrugsPrefered, fallback: this.reportableDrugsFallback}, error: undefined };
        });
        this.get<ApiInterfaceEmptyIn, ApiInterfaceFarmersOut>("farmers", async (req, user) => {
            await this.updateFarmersMutex.waitForUnlock();
            return { statusCode: 200, responseObject: {farmers: this.farmers}, error: undefined };
        });
        this.postJson<ApiInterfacePutPrescriptionRowsIn, ApiInterfaceEmptyOut>("report", async (req, user) => {
            try {
                let userInfo = await getApiModule(ApiModuleLdapQuery).readUserInfo(user.sid);
                let expectedVetName = userInfo.vetproofVeterinaryName;
                let readVetName = req.body.drugReport.veterinary;

                if (expectedVetName == readVetName) {
                    let response = await this.qsApiHandler.postDrugReport(req.body.drugReport);
                    return { statusCode: 200, responseObject: {}, error: undefined };
                } else {
                    throw new Error("Stated veterinary name of drug report does not match vet name registered for user in LDAP!");                    
                }
            } catch(err) {
                console.error("Error processing QS veterinary document post request: ", err);
                return { statusCode: 500, responseObject: {}, error: "Error posting veterinary document to API! " + err };
            }
        });
    }
}
