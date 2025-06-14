import vetproof = require('vet_proof_external_tools_api');
import {QsAccessToken} from './qs_accesstoken'
import { DrugReport } from '../../../api_common/api_qs';
const util = require('util');
const config = require('config');

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
    
    constructor() {
        this.client = new vetproof.ApiClient(config.get('generic.QS_API_SYSTEM'));
        this.authApi = new vetproof.AuthenticationApi(this.client);
        this.vetDocumentsApi = new vetproof.TierarztBelegeApi(this.client);
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
                    console.log("Constructed new token for user_id: ", this.accessToken.userId, " valid until: ", this.accessToken.getExpirationTimeString());
                
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
                console.log("Checked QS access token. Still valid until: " + this.accessToken.getExpirationTimeString());
                res();
            } else {
                if (this.accessToken)
                    console.log("Checked QS access token. Token expired " + this.accessToken.getExpirationTimeString() + ". We now request a new token!");
                else
                    console.log("Requesting initial access token!");
    
                this.renewAccessToken().then(() => {
                    console.log("We got a new QS access token!");
                    res();
                }).catch((err) => {
                    console.log("There was an error refreshing our access token of QS!:", err);
                    rej();
                });
            }
        });
    }

    sendAuthenticatedPing() {
        const pingApi = new vetproof.PingApi(this.client);
        this.checkAndRenewAccessToken().then(() => {
            pingApi.pingGet({}, (error, data, response) => {
                console.log(error, data, response);
            });
        }).catch(() => {
            console.error("Error refreshing QS access token!");
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
                console.log("Reading in QS-Farmers for branch " + branch);
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

    postDrugReport(drugReport: DrugReport): Promise<string> {
        return new Promise<string>((res, rej) => {
            this.checkAndRenewAccessToken().then(() => {
                let drugReportStr = util.inspect(drugReport, {showHidden: false, depth: null, colors: true});
                console.log("Sending new drug report to QS: ", drugReportStr);
                this.vetDocumentsApi.veterinaryDocumentsPost(drugReport, (error, data, response) => {
                    if (error) {
                        console.error("Error posting prescription-row to API (early error): sent data:", drugReportStr, "got error", error.message, response.text);
                        rej(this.parseErrors(JSON.parse(response.text)));
                    } else {
                        if (response.statusCode == 200) { // OK
                            let rowID = data[0];
                            console.log("Successfully posted prescription-row to API! Resulting row ID:", rowID);
                            res(rowID);
                        } else if(response.statusCode == 400) { // Content is invalid or too short
                            console.error("Error posting prescription-row to API (400): sent data:", drugReportStr, "got error", data);
                            rej(this.parseErrors(JSON.parse(response.text)));
                        } else if(response.statusCode == 403) { // Our access token is not allowed to perform this operation
                            console.error("Error posting prescription-row to API (403): sent data:", drugReportStr, "got error", data);
                            rej(this.parseErrors(JSON.parse(response.text)));
                        } else if(response.statusCode == 404) { // The given data could not be found
                            console.error("Error posting prescription-row to API (404): sent data:", drugReportStr, "got error", data);
                            rej(this.parseErrors(JSON.parse(response.text)));
                        } else {
                            console.error("Error posting prescription-row to API (unknown status: " + response.statusCode + "): sent data:", drugReportStr, "got error", data);
                            rej(this.parseErrors(JSON.parse(response.text)));
                        }
                    }
                });
            }).catch(() => {
                console.error("Error posting prescription-row to API (error renewing QS access token!)");
                rej("Error renewing QS Access-Token!");
            });
        });
    }
}
