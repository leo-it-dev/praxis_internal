import { Mutex } from 'async-mutex';
import { ApiInterfaceDrugsOut, ApiInterfaceFarmersOut, ApiInterfacePutPrescriptionRowsIn, castReportReadbackFromVeterinaryDocumentData, DrugReport, DrugReportApiReadback, DrugUnits, ReportableDrug } from '../../../api_common/api_qs';
import { ApiInterfaceEmptyIn, ApiInterfaceEmptyOut } from '../../../api_common/backend_call';
import { QsFarmerAnimalAgeUsageGroup } from '../../../api_common/qs/qs-farmer-production-age-mapping';
import { QsFarmerProductionCombination } from '../../../api_common/qs/qs-farmer-production-combinations';
import { ApiModule } from '../../api_module';
import { performPatches } from '../../ext_config_patcher';
import { getApiModule } from '../../index';
import { getLogger } from '../../logger';
import { sleep, sum } from '../../utilities/utilities';
import { ApiModuleLdapQuery } from '../ldapquery/api_ldapquery';
import { readReportableDrugListFromHIT } from './hit_drug_crawler';
import { readReportableDrugListFromMovetaDB } from './moveta_drug_crawler';
import { Farmer, QsApiHandler } from './qsapi_handler';
import vetproof = require('vet_proof_external_tools_api');
const config = require('config');

export class QsApiDocumentReports {
    qsReportsOfficialPage: Array<DrugReportApiReadback> = [];
    qsReportsIntranetModule: Array<DrugReportApiReadback> = [];
}

export class ApiModuleQs extends ApiModule {

    MAX_QS_REPORT_NUMBER_LENGTH_CHARS = 20;
    INTRANET_QS_REPORT_NUMBER_WATERMARK = "_A";
    QS_API_MAX_ENTRIES_PER_REPORT_READ = 100;

    private qsApiHandlerTest: QsApiHandler;
    private qsApiHandlerProd: QsApiHandler;
    private reportableDrugsPrefered: Array<ReportableDrug> = []; // List of drugs that *should* cover all drugs we use.
    private reportableDrugsFallback: Array<ReportableDrug> = []; // If there are drugs missing though, a vet may also use drugs from the fallback list.
    private farmers: Array<Farmer> = [];
    private qsApiReports: QsApiDocumentReports = new QsApiDocumentReports();

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

    async verifyReportabilityOfDrugList(drugList: Array<ReportableDrug>) {
        let logger = getLogger('qs-znr-validator');
        let reference = new Date().getTime();
        logger.info("Starting drug ZNR verification cycle.", {reference: reference});

        let farmer = this.farmers[0];
        let productionType = QsFarmerProductionCombination.splitProductionIdIntoAPICompatibleIDs(farmer.productionType[0])[0];
        let usageGroup = QsFarmerAnimalAgeUsageGroup.getUsageGroupsBasedOnProductionType(productionType.productionType)[0];

        let erronousDrugs = [];
        let successfullDrugs = [];

        for(let drugNumber = 0; drugNumber < drugList.length; drugNumber++) {
            let drug = drugList[drugNumber];
            let date = new Date();
            let drugReport: DrugReport = {
                deliveryDate: date.getFullYear() + "-" + String(date.getMonth() + 1).padStart(2, '0') + "-" + String(date.getDate()).padStart(2, '0'),
                documentNumber: '_V' + date.getTime(),
                locationNumber: farmer.locationNumber,
                veterinary: config.get('generic.QS_API_AUTOMATED_DRUG_TEST_USER'),
                prescriptionRows: [{
                    animalCount: 1,
                    animalGroup: usageGroup.usageGroup,
                    drugs: [
                        {
                            amount: 1,
                            applicationDuration: 1,
                            packageId: drug.forms[0].pid,
                            amountUnit: (drug.forms[0].unitSuggestion || DrugUnits.injector).id,
                            approvalNumber: drug.znr
                        }
                    ]}
                ]
            };

            await new Promise<void>((res, _) => {
                setTimeout(() => {
                    this.qsApiHandlerTest.postDrugReport(drugReport, false).then((dat) => {
                        // successfully posted, drugs are all valid.
                        drug.reportabilityVerifierMarkedErronous = false;
                        successfullDrugs.push(drug);
                        logger.debug("Following drug is marked valid (" + drugNumber + "/" + drugList.length + "): ", {drugReport: drugReport, drug: drug, reference:reference});
                        res();
                    }).catch((err) => {
                        // error posting, drugs contain invalid ZNRs or drug units.
                        drug.reportabilityVerifierMarkedErronous = true;
                        erronousDrugs.push({drugReport: drugReport, drug: drug, err: err});
                        logger.debug("Following drug is marked invalid (" + drugNumber + "/" + drugList.length + "): ", {drugReport: drugReport, drug: drug, err: err, reference:reference});
                        res();
                    });
                }, config.get('generic.QS_API_AUTOMATED_DRUG_TEST_INTERVAL_SECONDS') * 1000);
            });
        }

        logger.info("Finished drug ZNR verification cycle.", {successfull: successfullDrugs.length, erronous: erronousDrugs.length, reference:reference});
    }

    async updateDrugs() {
        const inst = this;
        this.logger().info("Scheduled update of internal databases of reportable drugs!");

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
                    this.logger().error("Error receiving drug list from provider!", {provider: database.logname, reason: drug.reason.trim("\n")});
                }
            });
            this.updateDrugsMutex.release();
            this.logger().info(logStr);
        
            this.logger().info("Received all drugs, starting reportability check of approval numbers of primary drug list!");
            this.verifyReportabilityOfDrugList(this.reportableDrugsPrefered);
        });
    }

    async updateQsDatabase() {
        const inst = this;
        return new Promise<void>(async (res, rej) => {
            this.logger().info("Scheduled update of internal database of QS informations!");
            await this.updateFarmersMutex.acquire();
    
            this.qsApiHandlerProd.readFarmers().then(farmers => {
                inst.farmers = farmers;
                this.logger().info("Successfully updated list of registered farmers!", {entryCount: this.farmers.length});
            }).catch(e => {
                this.logger().error("Error updating internal database of registered farmers!", {error: e});
            }).finally(() => {
                this.updateFarmersMutex.release();
                res();
            });
        });
    }

    async receiveQsReportsAndGenerateOverview() {
        let logger = getLogger('qs-report-fetcher');
        
        let apiDocumentReports: QsApiDocumentReports = new QsApiDocumentReports();
        
        logger.info("Starting new QS-API report read cycle. Extracting all QS drug reports.");

        try {
            let offset = 0;
            let data = undefined;
            let drugReport: vetproof.VeterinaryDocumentData;
            do {
                data = await this.qsApiHandlerProd.requestDrugReports(this.QS_API_MAX_ENTRIES_PER_REPORT_READ, offset);
                let reportCountModule = 0;
                let reportCountOfficialPage = 0;

                for (drugReport of data.documents) {
                    
                    let drugReportOurFormat = castReportReadbackFromVeterinaryDocumentData(drugReport);

                    // TODO: Verify drugReport is compatible with type:DrugReport
                    if (drugReport.documentNumber.endsWith(this.INTRANET_QS_REPORT_NUMBER_WATERMARK)) {
                        // Qs report was sent by this module
                        apiDocumentReports.qsReportsIntranetModule.push(drugReportOurFormat);
                        reportCountModule++;
                    } else {
                        // Qs report was sent by the original webpage
                        apiDocumentReports.qsReportsOfficialPage.push(drugReportOurFormat);
                        reportCountOfficialPage++;
                    }
                }

                logger.debug("QS-Api report read cycle read next chunk of reports!", {reportCountModule: reportCountModule, reportCountOfficialPage: reportCountOfficialPage});
                offset += this.QS_API_MAX_ENTRIES_PER_REPORT_READ;
                await sleep(100);
            } while(data.moreData);
            logger.info("Finished QS-API report read cycle.", {documentCountModule: apiDocumentReports.qsReportsIntranetModule.length, documentCountOfficialPage: apiDocumentReports.qsReportsOfficialPage.length});
        } catch(er) {
            logger.error("Error reading qs reports from QS-API! " + er);
        }
        this.qsApiReports = apiDocumentReports;
    }

    async initialize() {
        this.qsApiHandlerTest = new QsApiHandler(config.get('generic.QS_API_SYSTEM_TEST'), "test");
        this.qsApiHandlerProd = new QsApiHandler(config.get('generic.QS_API_SYSTEM'), "prod");

        await this.qsApiHandlerTest.renewAccessToken();
        await this.qsApiHandlerProd.renewAccessToken();

        try {
            this.logger().info("Detected Vetproof Gateway Version (Testsystem)!", {version: await this.qsApiHandlerTest.requestVersionInformation()});
            this.logger().info("Detected Vetproof Gateway Version (Prodsystem)!", {version: await this.qsApiHandlerProd.requestVersionInformation()});
        } catch (e) {
            this.logger().error("Error detecting Vetproof Gateway Version!", {error: e});
        }

        setInterval(this.updateQsDatabase.bind(this), config.get('generic.QS_DATABASE_CRAWL_UPDATE_INTERVAL_DAYS') * 24 * 60 * 60 * 1000);
        this.updateQsDatabase().then(() => {
            setInterval(this.updateDrugs.bind(this), config.get('generic.DRUGS_CRAWLING_INTERVAL_DAYS') * 24 * 60 * 60 * 1000);
            this.updateDrugs();
        });
        
        setInterval(this.receiveQsReportsAndGenerateOverview.bind(this), config.get('generic.QS_DATABASE_CRAWL_UPDATE_REPORTS_INTERVAL_DAYS') * 24 * 60 * 60 * 1000);
        this.receiveQsReportsAndGenerateOverview();
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
            let readVetName = "<error>"
            try {
                let userInfo = await getApiModule(ApiModuleLdapQuery).readUserInfo(user.sid);
                let expectedVetName = userInfo.vetproofVeterinaryName;
                readVetName = req.body.drugReport.veterinary;

                let maxReportNumberLengthFrontend = this.MAX_QS_REPORT_NUMBER_LENGTH_CHARS - this.INTRANET_QS_REPORT_NUMBER_WATERMARK.length;
                if (req.body.drugReport.documentNumber.length > maxReportNumberLengthFrontend) {
                    throw new Error("Stated report number is too long: " + req.body.drugReport.documentNumber + "! Max of " + maxReportNumberLengthFrontend + " chars!");
                }

                // append watermark suffix to report number, in order for grafana analytics to separate between reports generated by our intranet frontend and reports generated on the official web page.
                req.body.drugReport.documentNumber += this.INTRANET_QS_REPORT_NUMBER_WATERMARK;

                if (expectedVetName == readVetName) {
                    let response = await this.qsApiHandlerProd.postDrugReport(req.body.drugReport);
                    this.logger().info("Successfully sent QS document post request by veterinary!", {username: readVetName, drugReport: req.body.drugReport, success:true});
                    return { statusCode: 200, responseObject: {}, error: undefined };
                } else {
                    throw new Error("Stated veterinary name of drug report does not match vet name registered for user in LDAP!");                    
                }
            } catch(err) {
                this.logger().error("Error sending QS document post request by veterinary!", {error: err, success: false, username: readVetName, drugReport: req.body.drugReport});
                return { statusCode: 500, responseObject: {}, error: "Error posting veterinary document to API! " + err };
            }
        });
    }
}
