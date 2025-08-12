import vetproof = require('vet_proof_external_tools_api');
import { DrugReport } from '../../../api_common/api_qs';
import { getLogger } from '../../logger';
import { QsAccessToken } from './qs_accesstoken';
const config = require('config');
const crypto = require('crypto');

export type Farmer = {
    name: string; // Eindeutige Identifikation des Tierhalters in VetProof
    locationNumber: string; // VVVO-Nummer des Tierhalters
    productionType: number[]; // Produktionsart laut QS, evtl mehrere wenn Rind und Schwein
    qsNumber: string; // QS-Nummer des Tierhalters
    vpId: number; // Eindeutige Identifikation des Tierhalters in VetProof
};

export class QsApiHandler {
    private client: vetproof.ApiClient;
    private authApi: vetproof.AuthenticationApi;
    private vetDocumentsApi: vetproof.TierarztBelegeApi;

    private accessToken: QsAccessToken | undefined = undefined;
    
    private logger = getLogger('qs-api-handler');

    constructor() {
        this.client = new vetproof.ApiClient(config.get('generic.QS_API_SYSTEM'));
        this.authApi = new vetproof.AuthenticationApi(this.client);
        this.vetDocumentsApi = new vetproof.TierarztBelegeApi(this.client);
    }

    requestSingleDrugReport(id: number): Promise<vetproof.VeterinaryDocumentData> {
        return new Promise((res, rej) => {
            new vetproof.TierarztBelegeApi(this.client).veterinaryDocumentsIdGet({id: id}, (error, data, resp) => {
                if (error) {
                    rej(error);
                } else {
                    res(data);
                }
            });
        });
    }

    requestDrugReports(limit: number, offset: number): Promise<vetproof.VeterinaryDocumentDataList> {
        return new Promise((res, rej) => {
            new vetproof.TierarztBelegeApi(this.client).veterinaryDocumentsGet({limit: limit, offset: offset}, (error, data, resp) => {
                if (error) {
                    rej(error);
                } else {
                    res(data);
                }
            });
        });
    }

    requestVersionInformation(): Promise<string> {
        return new Promise((res, rej) => {
            this.checkAndRenewAccessToken().then(() => {
                new vetproof.VersionApi(this.client).versionGet((error, data, response) => {
                    if (error) {
                        rej(error);
                    } else {
                        res(JSON.parse(data));
                    }
                });
            }).catch(() => {
                rej("Error refreshing QS access token!");
            });
        });
    }

    renewAccessToken(): Promise<string> {
        return new Promise((res, rej) => {
            this.authApi.accessTokenPost({'accessTokenInput': {'id': config.get('generic.GATEWAY_ID'), 'alias': config.get('generic.USER_ALIAS'), 'password': config.get('generic.USER_PASSWORD')}}, (error, data, response) => {
                if (error) {
                    rej(error);
                } else {
                    this.accessToken = new QsAccessToken(data.token);
                    this.logger.info("Constructed new token for user_id with specified validity time!", {userId: this.accessToken.userId, validDuration: this.accessToken.getExpirationTimeString()});
                
                    let vetproofGatewayToken = this.client.authentications['vetproofGatewayToken'];
                    vetproofGatewayToken.accessToken = this.accessToken.getRawToken();
                    res(data);
                }
            });    
        });
    }

    checkAndRenewAccessToken(): Promise<void> {
        return new Promise((res, rej) => {
            const accessTokenStillValid = this.accessToken && this.accessToken.isTokenStillValid();
            if (accessTokenStillValid) {
                this.logger.info("Checked QS access token validity duration!", {duration: this.accessToken.getExpirationTimeString()});
                res();
            } else {
                if (this.accessToken)
                    this.logger.warn("Checked QS access token. Token expired. We now request a new token!", {expirationTime: this.accessToken.getExpirationTimeString()});
                else
                    this.logger.info("Requesting initial access token!");
    
                this.renewAccessToken().then(() => {
                    this.logger.info("We got a new QS access token!");
                    res();
                }).catch((err) => {
                    this.logger.error("There was an error refreshing our access token of QS!", {error: err});
                    rej();
                });
            }
        });
    }

    sendAuthenticatedPing() {
        const pingApi = new vetproof.PingApi(this.client);
        this.checkAndRenewAccessToken().then(() => {
            pingApi.pingGet({}, (error, data, response) => {
                this.logger.info("Sent ping to QS!", {error: error, data: data, response: response});
            });
        }).catch((err) => {
            this.logger.error("Error refreshing QS access token!", {error: err});
        });
    }

    async syncFarmerGet(api: vetproof.FreigeschalteteTierhalterApi, branchName: string, offset: number, limit: number): Promise<{ error: string | undefined; response: vetproof.FarmerLinkList | undefined; }> {
        try {
            await this.checkAndRenewAccessToken();

            let data = await new Promise<any>((res, rej) => {
                api.farmerLinkGet(branchName, {'offset': offset, 'limit': limit}, (error, data, response) => {
                    if (error) {
                        rej(response.text);
                    } else {
                        if (data instanceof vetproof.FarmerLinkList) {
                            res(data);
                        } else {
                            rej("farmerLinkGet returned invalid type object!");
                        }
                    }
                });
            });
            return { error: undefined, response: data };
        } catch(err) {
            return { error: err, response: undefined };
        }
    }

    readFarmers(): Promise<Array<Farmer>> {
        return new Promise<Array<Farmer>>(async (res, rej) => {
            let farmers: Array<Farmer> = [];

            const farmerLinkApi = new vetproof.FreigeschalteteTierhalterApi(this.client);
            // vetproof.AnimalBranchEnum.CATTLE_BRANCH
            let branches = ["CATTLE_BRANCH", "PIG_BRANCH"];

            for (let branch of branches) {
                this.logger.info("Reading in QS-Farmers for specified branch!", {branch: branch});
                let offset = 0;
                let data;

                do {
                    data = await this.syncFarmerGet(farmerLinkApi, branch, offset, 100);
                    offset += 100;

                    if (data.error === undefined) {
                        for (let farmer of data.response.farmers) {
                            let farmerAlreadyFound = farmers.find(f => f.locationNumber === farmer["locationNumber"]);
                            if (farmerAlreadyFound !== undefined) {
                                // Append production type if farmer is already found in a previous branch
                                farmerAlreadyFound.productionType.push(farmer["productionType"]);
                            } else {
                                let name = farmer["farmerDisplayName"] as string;
                                let locationNumber = farmer["locationNumber"] as string;
                                let productionType = farmer["productionType"] as number;
                                let qsNumber = farmer["qsNumber"] as string;
                                let vpId = farmer["vpId"] as number;
    
                                // Based on an analysis and comparison between data and the Vetproof Webpage,
                                // it seems as the QS-Webpage doesn't list farmers which have no qsNumber.
                                // Therefore we also filter them out at this point, to prevent confusion.
                                if (!qsNumber || qsNumber.trim().length == 0) {
                                    continue;
                                }
    
                                // Add a new instance otherwise
                                let farmInst: Farmer = {
                                    name: name,
                                    locationNumber: locationNumber,
                                    productionType: [productionType],
                                    qsNumber: qsNumber,
                                    vpId: vpId
                                };
                                farmers.push(farmInst);
                            }
                        }
    
                    } else {
                        rej(data.error);
                        return;
                    }
                } while(data.response.moreData);
            }

            // Last branch handled. Sort all found farmers.
            farmers = farmers.sort((a, b) => a.name.localeCompare(b.name));
            res(farmers);
        });
    }

    parseErrors(errorObj: JsonObject): string {
        let listErrors = [];
        for(let errorField of Object.keys(errorObj)) {
            if (errorObj[errorField].localizedMessage) {
                listErrors.push(errorField + ": " + errorObj[errorField].localizedMessage);
            }
        }
        return listErrors.join(',');
    }

    postDrugReport(drugReport: DrugReport, failureIsErrorLevel: boolean = true): Promise<string> {
        return new Promise<string>((res, rej) => { // Don't convert to function reference! Somehow 'service' field is not sent then.
            let logFailure = (message, ...args) => {
                if (failureIsErrorLevel) {
                    this.logger.error(message, ...args);
                } else {
                    this.logger.warn(message, ...args);
                }
            };

            let reference = crypto.randomUUID();
            this.checkAndRenewAccessToken().then(() => {
                this.logger.info("Sending new drug report to QS!", {drugReport: drugReport, reference:reference});
                this.vetDocumentsApi.veterinaryDocumentsPost(drugReport, (error, data, response) => {
                    if (error) {
                        this.logger.warn("Error posting prescription-row to API (early error): sent data but got an error!", {report: drugReport, error: error.message, responseText: response.text, reference:reference});
                        rej(this.parseErrors(JSON.parse(response.text)));
                    } else {
                        if (response.statusCode == 200) { // OK
                            let rowID = data[0];
                            this.logger.info("Successfully posted prescription-row to API! Got resulting row ID!", {rowID: rowID, reference:reference});
                            res(rowID);
                        } else if(response.statusCode == 400) { // Content is invalid or too short
                            logFailure("Error posting prescription-row to API (400): sent data but got an error!", {report: drugReport, error: data, reference:reference});
                            rej(this.parseErrors(JSON.parse(response.text)));
                        } else if(response.statusCode == 403) { // Our access token is not allowed to perform this operation
                            logFailure("Error posting prescription-row to API (403): sent data but got an error!", {report: drugReport, error: data, reference:reference});
                            rej(this.parseErrors(JSON.parse(response.text)));
                        } else if(response.statusCode == 404) { // The given data could not be found
                            logFailure("Error posting prescription-row to API (404): sent data but got error!", {report: drugReport, error: data, reference:reference});
                            rej(this.parseErrors(JSON.parse(response.text)));
                        } else {
                            logFailure("Error posting prescription-row to API (unknown status-code received while sending data)", {report: drugReport, statusCode: response.statusCode, error: data, reference:reference});
                            rej(this.parseErrors(JSON.parse(response.text)));
                        }
                    }
                });
            }).catch((err) => {
                logFailure("Error posting prescription-row to API (error renewing QS access token!)", {error: err, reference:reference});
                rej("Error renewing QS Access-Token!");
            });
        });
    }
}
