import { Mutex } from 'async-mutex';
import { ApiInterfaceDrugsOut, ApiInterfaceFarmersOut, ApiInterfacePutPrescriptionRowsIn, castReportReadbackFromVeterinaryDocumentData, DrugReport, DrugReportApiReadback, Farmer } from '../../../api_common/api_qs';
import { ApiInterfaceEmptyIn, ApiInterfaceEmptyOut } from '../../../api_common/backend_call';
import { Business } from '../../../api_common/generic_types/business';
import { Customer } from '../../../api_common/generic_types/customer';
import { Drug, DrugUnits, DrugVerifiedState } from '../../../api_common/generic_types/drug';
import { UserPermission } from '../../../api_common/permission_types';
import { QsFarmerAnimalAgeUsageGroup } from '../../../api_common/qs/qs-farmer-production-age-mapping';
import { QsFarmerProductionCombination } from '../../../api_common/qs/qs-farmer-production-combinations';
import { ApiModuleAuthorized } from '../../api_module';
import { performPatches } from '../../ext_config_patcher';
import { getApiModule, getRepeatedScheduler } from '../../index';
import { getLogger } from '../../logger';
import { sleep, sum } from '../../utilities/utilities';
import { ApiModuleEntities } from '../entities/api_entities';
import { ApiModuleLdapQuery } from '../ldapquery/api_ldapquery';
import { QsApiHandler } from './qsapi_handler';
import vetproof = require('vet_proof_external_tools_api');
const config = require('config');

export class QsApiDocumentReports {
    qsReportsOfficialPage: Array<DrugReportApiReadback> = [];
    qsReportsIntranetModule: Array<DrugReportApiReadback> = [];
}

export type DrugReportability = {
    znr: string,
    pid: number,
    reportable: boolean
}

export class ApiModuleQs extends ApiModuleAuthorized {

    MAX_QS_REPORT_NUMBER_LENGTH_CHARS = 20;
    INTRANET_QS_REPORT_NUMBER_WATERMARK = "_A";
    QS_API_MAX_ENTRIES_PER_REPORT_READ = 100;

    private moduleEntities!: ApiModuleEntities;

    private qsApiHandlerTest!: QsApiHandler;
    private qsApiHandlerProd!: QsApiHandler;
    private farmers: Array<Farmer> = [];

    private updateDrugsMutex = new Mutex();
    private updateFarmersMutex = new Mutex();

    modname(): string {
        return "qs";
    }

    moduleInitialized(): void {
        this.moduleEntities = getApiModule(ApiModuleEntities)!;
    }

    initializeDrugSources() {
        performPatches([
            // /etc/odbc.ini and /opt/Unify/SQLBase/sql.ini contain placeholders as part of the installation process.
            // create a backup of the placeholder file variants and resolve all placeholders with the <movetaOdbcConnection> configuration section.
            {configurationBase: "movetaOdbcConnection", patchPaths: ["/etc/odbc.ini", "/opt/Unify/SQLBase/sql.ini"]}
        ]);
    }

    permissionRequired(): UserPermission | undefined {
        return UserPermission.QS_REPORT;
    }

    async verifyReportabilityOfDrugList(drugList: Array<Drug>) {
        let logger = getLogger('qs-znr-validator');
        let reference = new Date().getTime();
        logger.info("Starting drug ZNR verification cycle.", {reference: reference});

        let farmer = this.farmers[0];
        let productionType = QsFarmerProductionCombination.splitProductionIdIntoAPICompatibleIDs(farmer.productionType[0])[0];
        let usageGroup = QsFarmerAnimalAgeUsageGroup.getUsageGroupsBasedOnProductionType(productionType.productionType)[0];

        let erronousDrugs = 0;
        let successfullDrugs = 0;

        for(let [drugNumber, drug] of drugList.entries()) {
            switch(drug.intranet.reportabilityVerifierMarkedErronous) {
                case DrugVerifiedState.eVERIFIED_NOT_REPORTABLE:
                    logger.debug("Following drug is marked invalid cached (" + drugNumber + "/" + drugList.length + "): ", {drug: drug, reference:reference});
                    erronousDrugs++;
                    break;
                case DrugVerifiedState.eVERIFIED_SUCCESSFULLY_REPORTABLE:
                    logger.debug("Following drug is marked valid cached (" + drugNumber + "/" + drugList.length + "): ", {drug: drug, reference:reference});
                    successfullDrugs++;
                    break;
                case DrugVerifiedState.eNOT_TESTED:
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
                                    packageId: drug.moveta.forms[0].pid,
                                    amountUnit: (drug.moveta.forms[0].unitSuggestion || DrugUnits.injector).id,
                                    approvalNumber: drug.moveta.znr
                                }
                            ]}
                        ]
                    };

                    await sleep(config.get('generic.QS_API_AUTOMATED_DRUG_TEST_INTERVAL_SECONDS') * 1000, (res) => {
                        this.qsApiHandlerTest.postDrugReport(drugReport, false).then((dat) => {
                            // successfully posted, drugs are all valid.
                            drug.intranet.reportabilityVerifierMarkedErronous = DrugVerifiedState.eVERIFIED_SUCCESSFULLY_REPORTABLE;
                            successfullDrugs++;
                            logger.debug("Following drug is marked valid (" + drugNumber + "/" + drugList.length + "): ", {drugReport: drugReport, drug: drug, reference:reference});
                        }).catch((err) => {
                            // error posting, drugs contain invalid ZNRs or drug units.
                            drug.intranet.reportabilityVerifierMarkedErronous = DrugVerifiedState.eVERIFIED_NOT_REPORTABLE;
                            erronousDrugs++;
                            logger.debug("Following drug is marked invalid (" + drugNumber + "/" + drugList.length + "): ", {drugReport: drugReport, drug: drug, err: err, reference:reference});
                        }).finally(async () => {
                            await this.moduleEntities.addOrUpdateDrugEntry(drug);
                            res();
                        });
                    });
                    break;
            }
        }
        logger.info("Finished drug ZNR verification cycle.", {successfull: successfullDrugs, erronous: erronousDrugs, reference:reference});
    }

    async updateDrugs(finished: () => void) {
        const inst = this;
        this.logger().info("Scheduled update of internal databases of reportable drugs!");
        this.initializeDrugSources();
        this.logger().info("Received all drugs, starting reportability check of approval numbers of primary drug list!");
        this.verifyReportabilityOfDrugList(await this.moduleEntities.getDrugEntities()).then(() => {
            finished();
        });
    }

    async hydrateQsFarmersWithMovetaBusinessInformation(farmers: Farmer[]): Promise<Farmer[]> {
        const inst = this;
        return new Promise<Farmer[]>((res, rej) => {
            this.logger().info("Reading business data from moveta to hydrate qs farmer information!");

            let customersList: Customer[] = [];
            let businessList: Business[] = [];

            let datasets = [
                {promise: this.moduleEntities.getBusinessEntries(), store: (businesses: any[]) => businessList = businesses},
                {promise: this.moduleEntities.getCustomerEntries(), store: (customers: any[]) => customersList = customers}
            ];

            Promise.allSettled(datasets.map(d => d.promise)).then(datasetsSettled => {
                for (let datasetIdx = 0; datasetIdx < datasets.length; datasetIdx++) {
                    let datasetSettled = datasetsSettled[datasetIdx];
                    if (datasetSettled.status != 'fulfilled') {
                        this.logger().error("Error reading customers and businesses from moveta to hydrate qs farmer data!", {});
                        rej();
                        return;
                    } else {
                        datasets[datasetIdx].store(datasetSettled.value);
                    }
                }

                for (let farmer of farmers) {
                    let businessMoveta = businessList.find(business => business.moveta.vvvo == farmer.locationNumber);
                    let customersRelatingToBusiness = customersList.filter(c => c.moveta.commonId == businessMoveta?.moveta.customerMovetaId);
                    if (businessMoveta === undefined) {
                        this.logger().warn("QS business entry found that has no corresponding business in pegasus!", {businessVVVO: farmer.locationNumber});
                        continue;
                    }
                    if (customersRelatingToBusiness.length == 0) {
                        this.logger().warn("Moveta business entry found with no active customer!", {businessVVVO: farmer.locationNumber, businessId: businessMoveta?.moveta.vvvo, expectedCustomerId: businessMoveta?.moveta.customerMovetaId});
                        continue;
                    }

                    if (customersRelatingToBusiness.length > 1) {
                        this.logger().warn("Moveta business entry found with more than one associated customer!", {businessVVVO: farmer.locationNumber, businessId: businessMoveta?.moveta.customerMovetaId, firstUsedCustomer: customersRelatingToBusiness[0].moveta.commonId, customerCount: customersRelatingToBusiness.length});
                        continue;
                    }

                    let customer = customersRelatingToBusiness[0];
                    farmer.additionalInfoHydrated = (customer.moveta.memo ?? "").trim(); // Temporär, später tatsächliche Betriebsadresse aus intranet
                }
                res(farmers);
            });
        });
    }

    async updateQsDatabase(finished: () => void) {
        const inst = this;
        return new Promise<void>(async (res, rej) => {
            this.logger().info("Scheduled update of internal database of QS informations!");
            await this.updateFarmersMutex.acquire();

            this.qsApiHandlerProd.readFarmers().then(async farmers => {
                try {
                    const farmersHydrated = await this.hydrateQsFarmersWithMovetaBusinessInformation(farmers);
                    inst.farmers = farmersHydrated;
                    this.logger().info("Successfully hydrated farmer list with moveta information!", {});
                } catch(err) {
                    inst.farmers = farmers;
                    this.logger().info("Error hydrating farmer list with moveta information!", {error: err});
                }

                this.logger().info("Successfully updated list of registered farmers!", {entryCount: this.farmers.length});
            }).catch(e => {
                this.logger().error("Error updating internal database of registered farmers!", {error: e});
            }).finally(() => {
                this.updateFarmersMutex.release();
                finished();
                res();
            });
        });
    }

    async receiveQsReportsAndGenerateOverview(finished: () => void) {
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
        finished();
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

        getRepeatedScheduler().scheduleRepeatedEvent(this, "qs-report-overview", config.get('generic.QS_DATABASE_CRAWL_UPDATE_REPORTS_INTERVAL_DAYS') * 24 * 60 * 60, this.receiveQsReportsAndGenerateOverview.bind(this), true);

        this.updateQsDatabase(() => null).then(() => {
            this.updateDrugs(() => {
                // we don't immediately trigger update-qs-database and update-drugs, as the second one requires the first one to have run at least once. Therefore we start them ourselves the first time in a specified order of execution.
                getRepeatedScheduler().scheduleRepeatedEvent(this, "update-qs-database", config.get('generic.QS_DATABASE_CRAWL_UPDATE_INTERVAL_DAYS') * 24 * 60 * 60, this.updateQsDatabase.bind(this), false);
                getRepeatedScheduler().scheduleRepeatedEvent(this, "update-drugs", config.get('generic.DRUGS_CRAWLING_INTERVAL_DAYS') * 24 * 60 * 60, this.updateDrugs.bind(this), false);
            });
        });
    }

    registerEndpoints() {
        this.get<ApiInterfaceEmptyIn, ApiInterfaceFarmersOut>("farmers", async (req, user) => {
            await this.updateFarmersMutex.waitForUnlock();
            return { statusCode: 200, responseObject: {farmers: this.farmers}, error: undefined };
        });
        this.postJson<ApiInterfacePutPrescriptionRowsIn, ApiInterfaceEmptyOut>("report", async (req, user) => {
            let readVetName = "<error>"
            try {
                let userInfo = await getApiModule(ApiModuleLdapQuery)!.readUserInfo(user.userTokenData.sid);
                readVetName = req.body.drugReport.veterinary;

                let maxReportNumberLengthFrontend = this.MAX_QS_REPORT_NUMBER_LENGTH_CHARS - this.INTRANET_QS_REPORT_NUMBER_WATERMARK.length;
                if (req.body.drugReport.documentNumber.length > maxReportNumberLengthFrontend) {
                    throw new Error("Stated report number is too long: " + req.body.drugReport.documentNumber + "! Max of " + maxReportNumberLengthFrontend + " chars!");
                }

                // append watermark suffix to report number, in order for grafana analytics to separate between reports generated by our intranet frontend and reports generated on the official web page.
                req.body.drugReport.documentNumber += this.INTRANET_QS_REPORT_NUMBER_WATERMARK;

                // Request by vets: Every vet should be able to send reports in the name of another vet. Therefore we don't explicitly check the stated vet name in the report, but just accept it blindly.
                if (userInfo.vetproofVeterinaryName != readVetName) {
                    this.logger().info("Veterinary sent drug report in the name of another vet. This message is purely informative.", { actualVet: userInfo.vetproofVeterinaryName, statedVet: readVetName });
                }

                await this.qsApiHandlerProd.postDrugReport(req.body.drugReport);
                this.logger().info("Successfully sent QS document post request by veterinary!", {username: readVetName, drugReport: req.body.drugReport, success:true});
                return { statusCode: 200, responseObject: {}, error: undefined };
            } catch(err) {
                this.logger().error("Error sending QS document post request by veterinary!", {error: err, success: false, username: readVetName, drugReport: req.body.drugReport});
                return { statusCode: 500, responseObject: {}, error: "Error posting veterinary document to API! " + err };
            }
        });
    }
}
