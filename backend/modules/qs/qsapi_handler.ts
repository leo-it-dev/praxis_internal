import vetproof = require('vet_proof_external_tools_api');
import {QsAccessToken} from './qs_accesstoken'
import {options} from '../../options'
import { DrugReport } from '../../../api_common/api_qs';
const util = require('util');

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
        this.client = new vetproof.ApiClient(options.QS_API_SYSTEM);
        this.authApi = new vetproof.AuthenticationApi(this.client);
        this.vetDocumentsApi = new vetproof.TierarztBelegeApi(this.client);
    }

    requestVersionInformation(): Promise<string> {
        return new Promise((res, rej) => {
            new vetproof.VersionApi(this.client).versionGet((error, data, response) => {
                if (error) {
                    rej(error);
                } else {
                    res(JSON.parse(data));
                }
            });
        });
    }

    renewAccessToken(): Promise<void> {
        return new Promise((res, rej) => {
            this.authApi.accessTokenPost({'accessTokenInput': {'id': options.GATEWAY_ID, 'alias': options.USER_ALIAS, 'password': options.USER_PASSWORD}}, (error, data, response) => {
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

    checkAndRenewAccessToken() {
        const accessTokenStillValid = this.accessToken && this.accessToken.isTokenStillValid();
        if (accessTokenStillValid) {
            console.log("Checked QS access token. Still valid until: " + this.accessToken.getExpirationTimeString());
        } else {
            if (this.accessToken)
                console.log("Checked QS access token. Token expired " + this.accessToken.getExpirationTimeString() + ". We now request a new token!");
            else
                console.log("Requesting initial access token!");

            this.renewAccessToken();
        }
    }

    sendAuthenticatedPing() {
        const pingApi = new vetproof.PingApi(this.client);
        pingApi.pingGet({}, (error, data, response) => {
            console.log(error, data, response);
        });
    }

    readFarmers(): Promise<Array<Farmer>> {
        return new Promise<Array<Farmer>>((res, rej) => {
            let farmers: Array<Farmer> = [];

            const farmerLinkApi = new vetproof.FreigeschalteteTierhalterApi(this.client);
            // vetproof.AnimalBranchEnum.CATTLE_BRANCH
            let branches = ["CATTLE_BRANCH", "PIG_BRANCH"];

            for (let branch of branches) {
                farmerLinkApi.farmerLinkGet(branch, {'offset': 0, 'limit': 100}, (error, data, response) => {
                    if (error) {
                        rej(response.text);
                    } else {
                        if (data instanceof vetproof.FarmerLinkList) {
                            for (let farmer of data.farmers) {
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
                            rej("farmerLinkGet returned invalid type object!");
                        }
                    }

                    // Last branch handled. We are async, so handle res() here and not at end of branch loop.
                    if (branch == branches[branches.length - 1]) {
                        farmers = farmers.sort((a, b) => a.name.localeCompare(b.name));
                        res(farmers);
                    }
                });
            }
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
            let drugReportStr = util.inspect(drugReport, {showHidden: false, depth: null, colors: true});
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
        });
    }
}
