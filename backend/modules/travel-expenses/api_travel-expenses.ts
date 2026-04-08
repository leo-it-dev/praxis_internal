import * as config from 'config';
import { getRepeatedScheduler } from "../..";
import { ApiInterfaceEmptyIn, ApiModuleResponse } from "../../../api_common/backend_call";
import { UserPermission } from "../../../api_common/permission_types";
import { ApiModule } from "../../api_module";
import * as ors from '../../framework/openrouteservice';
import { ApiInterfaceTravelExpensesMetaOut, TravelExpenseStage } from '../../../api_common/api_travelexpenses';

type TravelExpensesConfig = {
    COST_STAGES: [
        {
            distanceKm: number,
            travelExpense: number,
            color: string
        }
    ]
}

export class ApiModuleTravelExpenses extends ApiModule {

    centerOfEarthLat = config.get('map.CENTER_OF_EARTH_LAT') as number;
    centerOfEarthLon = config.get('map.CENTER_OF_EARTH_LON') as number;

    travelExpenseCostStages = (config.get('travel-expenses') as TravelExpensesConfig).COST_STAGES;
    travelExpenseIsochronesRecalculationIntervalMinutes = config.get('travel-expenses.TRAVEL_EXPENSE_ISOCHRONES_RECALCULATION_INTERVAL_MINUTES') as number;

    isochronesCostStages: TravelExpenseStage[] = [];

    modname(): string {
        return "travel-expenses";
    }

    async initialize() {
        getRepeatedScheduler().scheduleRepeatedEvent(this, "travel-expense-isochrones", this.travelExpenseIsochronesRecalculationIntervalMinutes * 60, async (finished) => { await this.recalculateIsochrones(); finished(); }, true);
    }

    loginRequired(): boolean {
        return true;
    }

    permissionRequired(): UserPermission | undefined {
        return UserPermission.TRAVEL_EXPENSES_MAP;
    }

    registerEndpoints(): void {
        this.get<ApiInterfaceEmptyIn, ApiInterfaceTravelExpensesMetaOut>("travelmeta", async (req, user) => {
            let result: ApiModuleResponse<ApiInterfaceTravelExpensesMetaOut>;
            result = {
                statusCode: 200, responseObject: {
                    cacheTillOnline: false,
                    centerOfEarth: {
                        lat: this.centerOfEarthLat,
                        lon: this.centerOfEarthLon,
                    },
                    travelExpenseStages: this.isochronesCostStages
                }, error: ""
            };
            return result;
        });
    }

    async recalculateIsochrones(): Promise<void> {
        return new Promise<void>((res, rej) => {
            ors.generateIsochrone(this.centerOfEarthLat, this.centerOfEarthLon, this.travelExpenseCostStages.map(s => s.distanceKm)).then(polys => {
                let stages: TravelExpenseStage[] = [];
                for (let i = 0; i < polys.length; i++) {
                    stages.push({
                        polygon: polys[i],
                        stageCost: this.travelExpenseCostStages[i].travelExpense,
                        color: this.travelExpenseCostStages[i].color,
                        stageID: i,
                        travelDistanceStartKm: i > 0 ? this.travelExpenseCostStages[i - 1].distanceKm : 0,
                        travelDistanceEndKm: this.travelExpenseCostStages[i].distanceKm
                    });
                }
                this.isochronesCostStages = stages;
                res();
            }).catch(err => {
                rej(err);
            });
        });
    }
}