import { ApiModule } from '../../api_module';
import { Farmer, QsApiHandler } from './qsapi_handler';
import { options } from '../../options';
import { readReportableDrugListFromHIT, ReportableDrug } from './hit_drug_crawler';

/*
✔️ ZNR 6500578.00.00
✔️ Arzneimittelname  Aciphen Kompaktat (VetProof: Präparat)
✔️ Vetproof Packungs-ID:
✔️    Packungsmenge 250g
✔️    Packungsbeschreibung OP250g; Schachtel

amount
amountUnit
applicationDuration

POST /veterinary-documents/prescriptionRows/animalGroup?? Händtisch oder automatisch auswerten irgendwie??
Farmer -> productionType must be split up into it's elements: e.g.: 1005 -> Mas
*/

export class ApiModuleQs extends ApiModule {

// TODO: Muxes

    private qsApiHandler: QsApiHandler;
    private reportableDrugs: Array<ReportableDrug> = [];
    private farmers: Array<Farmer> = [];

    modname(): string {
        return "qs";
    }

    loginRequired(): boolean {
        return true;
    }

    updateDrugs() {
        const inst = this;
        console.log("Scheduled update of internal database of reportable drugs...");
        readReportableDrugListFromHIT().then(rd => {
            inst.reportableDrugs = rd;
            let totalFormsCount =  inst.reportableDrugs.map(d => d.forms.length).reduce((a, b) => a + b, 0)
            console.log("Successfully read database of reportable drugs! Read " + rd.length + " drugs in a total of " + totalFormsCount + " packaging forms!");
        }).catch(e => {
            console.error("Error reading database of reportable drugs!", e);
        });
    }

    updateQsDatabase() {
        const inst = this;
        console.log("Scheduled update of internal database of QS informations...");
        this.qsApiHandler.readFarmers().then(farmers => {
            inst.farmers = farmers;
            console.log("Successfully updated list of registered farmers: " + this.farmers.length + " entries!");
        }).catch(e => {
            console.error("Error updating internal database of registered farmers: ", e);
        });
    }

    updateVeterinaryIDs() {
        this.qsApiHandler.readVeterinaryIDs();
    }

    async initialize() {
        this.qsApiHandler = new QsApiHandler();
    
        await this.qsApiHandler.renewAccessToken();

        try {
            let versionInformation = await this.qsApiHandler.requestVersionInformation();
            console.log("Detected Vetproof Gateway Version: " + versionInformation);
        } catch(e) {
            console.error("Error detecting Vetproof Gateway Version!: " + e);
        }

        setInterval(this.updateDrugs.bind(this), options.DRUGS_CRAWLING_INTERVAL_DAYS * 24 * 60 * 60 * 1000);
        this.updateDrugs();

        setInterval(this.updateQsDatabase.bind(this), options.QS_DATABASE_CRAWL_UPDATE_INTERVAL_DAYS * 24 * 60 * 60 * 1000);
        this.updateQsDatabase();

        this.updateVeterinaryIDs();
    }

    registerEndpoints() {
        this.get("auth", async (req, user) => {
            this.qsApiHandler.checkAndRenewAccessToken();
            return {statusCode: 200, responseObject: {}, error: undefined};
        });
        this.get("ping", async (req, user) => {
            this.qsApiHandler.sendAuthenticatedPing();
            return {statusCode: 200, responseObject: {}, error: undefined};
        })
        this.get("drugs", async (req, user) => {
            return {statusCode: 200, responseObject: this.reportableDrugs, error: undefined};
        });
        this.get("farmers", async (req, user) => {
            return {statusCode: 200, responseObject: this.farmers, error: undefined};
        });
    }
}
