import vetproof = require('vet_proof_external_tools_api');
import {QsAccessToken} from './qs_accesstoken'
import {options} from '../../options'

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
    private accessToken: QsAccessToken | undefined = undefined;
    
    constructor() {
        this.client = new vetproof.ApiClient(options.QS_API_SYSTEM);
        this.authApi = new vetproof.AuthenticationApi(this.client);
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

    readVeterinaryIDs(): string[] {
        /*new vetproof.TierarztIDApi(this.client).veterinaryIdGet(84559, {
            veterinaryName: "",
            veterinaryMedicalPractice: "Tierarzt Dr. Peter Mittermeier",
            country: 276,
            offset: 0,
            limit: 20
        }, (error, data, response) => {
            console.log(error, data, response);
        });*/

        return [];
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
}
