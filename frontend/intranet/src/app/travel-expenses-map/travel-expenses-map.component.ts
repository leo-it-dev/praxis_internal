import { Component, ElementRef, ViewChild } from '@angular/core';
import { ModuleComponent } from '../module/module/module.component';
import { TravelExpensesBackendFetch, TravelexpensesBackendService } from '../modules/travelexpenses/travelexpenses-backend.service';
import { WebMapComponent } from '../web-map/web-map.component';
import { TravelExpenseStage } from '../../../../../api_common/api_travelexpenses';

@Component({
	selector: 'app-travel-expenses-map',
	imports: [WebMapComponent],
	templateUrl: './travel-expenses-map.component.html',
	styleUrl: './travel-expenses-map.component.scss'
})
export class TravelExpensesMapComponent extends ModuleComponent {

	@ViewChild('map')
	mapComponent!: WebMapComponent;

	determiningLocation: boolean = false;

	currentLocation?: {
		lat: number,
		lon: number
	} = undefined;

	detectedTravelExpensesStage?: TravelExpenseStage = undefined;

	expandedView = false;

	constructor() {
		super(TravelexpensesBackendService)
	}

	metaData: TravelExpensesBackendFetch = {
		centerOfMap: {
			lat: 0,
			lon: 0
		},
		travelExpenseStages: []
	};

	override async afterViewInit() {
		await this.mapComponent.initMap();

		Promise.allSettled([this.getBackendService().fetchBackendData()]).then((proms) => {
			let backendTravelDataFetchProm = proms[0] as PromiseSettledResult<TravelExpensesBackendFetch>;

			if (backendTravelDataFetchProm.status == 'fulfilled') {
				this.metaData.centerOfMap = backendTravelDataFetchProm.value.centerOfMap;
				this.metaData.travelExpenseStages = backendTravelDataFetchProm.value.travelExpenseStages;
				console.log("Loaded travel expenses meta data!");

				this.mapComponent.centerMap(this.metaData.centerOfMap.lat, this.metaData.centerOfMap.lon, 10);
				this.mapComponent.addMarker(this.metaData.centerOfMap.lat, this.metaData.centerOfMap.lon, '#ff5555', "Praxis");

				let travelExpenseStages = backendTravelDataFetchProm.value.travelExpenseStages;
				let travelExpenseRings: GeoJSON.Feature<GeoJSON.Polygon>[] = [];
				for (let i = 0; i < travelExpenseStages.length; i++) {
					let polyColor = travelExpenseStages[i].color;
					let prevSmallerPoly = i > 0 ? travelExpenseStages[i - 1].polygon : undefined;
					let polyRing = this.mapComponent.addPolygon("poly" + i, travelExpenseStages[i].polygon, polyColor, '#999999', 1, prevSmallerPoly,
						"Kostenkreis " + i + " | " + this.formatCost(travelExpenseStages[i].stageCost)
					);
					travelExpenseRings.push(polyRing);
				}

				this.currentLocation = undefined;
				navigator.geolocation.getCurrentPosition(position => {
					this.currentLocation = {
						lat: position.coords.latitude,
						lon: position.coords.longitude,
					}

					// this.mapComponent.centerMap(position.coords.latitude, position.coords.longitude, 18);
					this.mapComponent.addMarker(position.coords.latitude, position.coords.longitude, '#5555ff', "Deine aktuelle Position");

					for (let ringIdx = 0; ringIdx < travelExpenseRings.length; ringIdx++) {
						let poly = travelExpenseRings[ringIdx];
						let intersects = this.mapComponent.checkIfIntersects(poly, position.coords.latitude, position.coords.longitude);
						if (intersects) {
							this.mapComponent.selectPolygon(poly);
							this.mapComponent.centerMapAroundFeaturePolygon(poly);
							this.detectedTravelExpensesStage = travelExpenseStages[ringIdx];
						}
					}
				});
			}
		});
	}

	formatCost(cost?: number) {
		if (cost) {
			return new Intl.NumberFormat("de-DE", { style: "currency", currency: "EUR" }).format(
				cost,
			);
		}
		return "...";
	}
}