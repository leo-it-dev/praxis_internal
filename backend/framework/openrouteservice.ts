import * as config from 'config';
import { getLogger } from '../logger';
import { Coordinate, Polygon } from '../../api_common/api_travelexpenses';

const orsEndpointURL = config.get('map.OPEN_ROUTE_SERVICE_ENDPOINT_URL');
const orsProfileName = config.get('map.OPEN_ROUTE_SERVICE_PROFILE');
const logger = getLogger("openrouteservice");

type OrsIsochronesResponse = {
    type: string,
    bbox: number[],
    features: [
        {
            type: string,
            properties: {
                group_index: number,
                value: number,
                center: number[]
            },
            geometry: {
                coordinates: number[][][],
                type: string
            }
        }
    ],
    metadata: object
}

export async function init(): Promise<void> {
    // test reachability of ORS instance.
    fetch(orsEndpointURL + "/health").then(dat => dat.json()).then(dat => {
        if (dat["status"] == "ready") {
            logger.info("Successfully contacted open route service instance!");
        } else {
            logger.info("Error contacting open route service instance! Invalid health data!", { health: dat });
        }
    }).catch(err => {
        logger.info("Error contacting open route service instance!", { error: new String(err) });
    })
}

export async function generateIsochrone(centerLat: number, centerLon: number, radiKm: number[]): Promise<Polygon[]> {
    return new Promise<Polygon[]>((res, rej) => {
        fetch(orsEndpointURL + "/isochrones/" + orsProfileName, {
            "headers": {
                "Content-Type": "application/json",
            },
            "body": JSON.stringify(
                {
                    locations: [[centerLon, centerLat]],
                    range: radiKm,
                    range_type: "distance",
                    units: "km"
                }),
            "method": "POST"
        }).then(dat => dat.json()).then(dat => {
            let typed = dat as OrsIsochronesResponse;
            let polygons: Polygon[] = [];

            for (let feature of typed.features) {
                if (feature.type.toLowerCase() != "feature") {
                    continue;
                }

                let geom = feature.geometry.coordinates[0];
                let coordinates = geom.map(coordPair => {
                    return { lon: coordPair[0], lat: coordPair[1] } as Coordinate;
                });

                polygons.push({ coords: coordinates });
            }

            res(polygons);
        }).catch(err => {
            rej(err);
        });
    });
}
