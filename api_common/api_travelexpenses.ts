import { ApiModuleInterfaceF2B } from "./backend_call"

/* Api endpoint news */


export type TravelExpenseStage = {
    polygon: Polygon,
    stageCost: number,
    color: string,
    stageID: number,
    travelDistanceStartKm: number,
    travelDistanceEndKm: number
}

export type Coordinate = {
    lat: number,
    lon: number
}

export type Polygon = {
    coords: Coordinate[]
}

export interface ApiInterfaceTravelExpensesMetaOut extends ApiModuleInterfaceF2B {
    centerOfEarth: {
        lat: number,
        lon: number
    },
    travelExpenseStages: TravelExpenseStage[]
};