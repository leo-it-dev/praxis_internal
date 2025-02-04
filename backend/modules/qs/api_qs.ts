import { ApiModule } from '../../api_module';
import { Farmer, QsApiHandler } from './qsapi_handler';
import { options } from '../../options';
import { readReportableDrugListFromMovetaDB } from './moveta_drug_crawler';
import { ReportableDrug } from './api_qs_types';
import { readReportableDrugListFromHIT } from './hit_drug_crawler';
import { sum } from '../../utilities/utilities';
// import { readReportableDrugListFromMovetaDB, ReportableDrug } from './moveta_drug_crawler';

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
    private reportableDrugsPrefered: Array<ReportableDrug> = []; // List of drugs that *should* cover all drugs we use.
    private reportableDrugsFallback: Array<ReportableDrug> = []; // If there are drugs missing though, a vet may also use drugs from the fallback list.

    private farmers: Array<Farmer> = [];

    modname(): string {
        return "qs";
    }

    loginRequired(): boolean {
        return true;
    }

    updateDrugs() {
        const inst = this;
        console.log("Scheduled update of internal databases of reportable drugs...");

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
                    logStr += " - " + database.logname + ": error: " + drug.reason + "\n";
                    console.error("Error receiving drug list from " + database.logname + " db: " + drug.reason);
                }
            })
            console.log(logStr);
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
        } catch (e) {
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
            return { statusCode: 200, responseObject: {}, error: undefined };
        });
        this.get("ping", async (req, user) => {
            this.qsApiHandler.sendAuthenticatedPing();
            return { statusCode: 200, responseObject: {}, error: undefined };
        })
        this.get("drugs", async (req, user) => {
            return { statusCode: 200, responseObject: {prefered: this.reportableDrugsPrefered, fallback: this.reportableDrugsFallback}, error: undefined };
        });
        this.get("farmers", async (req, user) => {
            return { statusCode: 200, responseObject: this.farmers, error: undefined };
        });
    }
}
