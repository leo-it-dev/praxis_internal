import { AfterViewInit, Component } from '@angular/core';
import maplibregl, { FeatureIdentifier } from "maplibre-gl";
import { PMTiles, Protocol } from "pmtiles";
import { IndexedDBMapSource, loadPMTiles } from './indexed-db-map-source';
import * as turf from '@turf/turf';
import { Coordinate, Polygon } from '../../../../../api_common/api_travelexpenses';
import * as geojson from 'geojson';
import { Subject, switchMap, timer } from 'rxjs';

@Component({
	selector: 'app-web-map',
	imports: [],
	templateUrl: './web-map.component.html',
	styleUrl: './web-map.component.scss'
})
export class WebMapComponent implements AfterViewInit {

	map!: maplibregl.Map;
	hoveredId: { [key: string]: string | number | null } = {};
	hoveringPopup!: maplibregl.Popup;
	showPopupTimer = new Subject<void>();
	allowShowPopup = false;

	selectedPoly?: geojson.Feature<geojson.Polygon>;

	constructor() {
	}

	ngAfterViewInit(): void {
	}

	async initMap(): Promise<void> {
		return new Promise((res, rej) => {
			fetch("map/style.json").then(d => d.json()).then(async json => {
				const url = "/map/planet.pmtiles";
				const buffer = await loadPMTiles(url);
				const source = new IndexedDBMapSource(buffer, url);
				const pmtiles = new PMTiles(source);

				const protocol = new Protocol();
				protocol.add(pmtiles);
				maplibregl.addProtocol("pmtiles", protocol.tile.bind(protocol));

				json.sprite = json.sprite.replace("{hostname}", location.hostname)
				json.glyphs = json.glyphs.replace("{hostname}", location.hostname)

				this.map = new maplibregl.Map({
					container: "map",
					style: json,
					center: [12.4668, 48.2163],
					zoom: 13,
					attributionControl: false
				});
				this.map.resize();

				let geojson = await fetch("map/countries.geojson").then(dat => dat.json());
				this.map.addSource("baselayer-land", {
					type: 'geojson',
					data: geojson
				});

				this.map.addLayer({
					id: 'baselayer-land',
					type: 'fill',
					source: 'baselayer-land',
					paint: {
						'fill-color': '#ffffff',
						'fill-opacity': 1.0
					}
				}, "park");

				this.map.addLayer({
					id: 'baselayer-land-outline',
					type: 'line',
					source: 'baselayer-land',
					paint: {
						'line-color': '#888',
						'line-width': 1
					}
				}, "park");

				this.hoveringPopup = new maplibregl.Popup({
					closeOnClick: false,
					closeButton: false,
					className: 'hovering-tooltip'
				}).addTo(this.map);

				this.showPopupTimer.pipe(
					switchMap(() => timer(200)) // 200ms timeout
				).subscribe(() => {
					if (this.allowShowPopup) {
						this.hoveringPopup.addClassName("tooltip-visible")
					}
				})

				const hatchSVG = `
				<svg xmlns="http://www.w3.org/2000/svg" width="8" height="8">
				<line x1="0" y1="8" x2="8" y2="0" stroke="red" stroke-width="1"/>
				</svg>
				`;
				let image = new Image();
				image.onload = (e) => {
					if (!this.map.hasImage('diagonal-hatch')) {
						this.map.addImage('diagonal-hatch', image);
					}
				};
				image.src = 'data:image/svg+xml;base64,' + btoa(hatchSVG);
				res();
			}).catch(_ => {
				rej();
			});
		});
	}

	getMapBounds(): [number, number, number, number] {
		let mapSource = this.map.getSource("openmaptiles") as maplibregl.VectorTileSource;
		if (mapSource) {
			return mapSource.bounds;
		} else {
			return [-90, -180, 90, 180];
		}
	}

	centerMap(lat: number, lon: number, zoom: number) {
		this.map.zoomTo(zoom, {
			animate: true,
			center: [lon, lat]
		})
		console.log("Recentered map to ", lat, lon);
	}

	addMarker(lat: number, lon: number, color?: string, popupMessage?: string) {
		let marker = new maplibregl.Marker({
			color: color,
		}).setLngLat([lon, lat])

		if (popupMessage) {
			marker.setPopup(
				new maplibregl.Popup({
					className: 'maplibre-popup'
				}).setText(popupMessage)
			)
		}

		marker.addTo(this.map);
	}

	addCircle(lat: number, lon: number, radiusKm: number) {
		let circle = turf.circle([lon, lat], radiusKm, {
			steps: 64,
			units: 'kilometers'
		});

		this.map.addSource('location-radius', {
			type: 'geojson',
			data: circle
		});

		this.map.addLayer({
			id: 'location-radius',
			type: 'fill',
			source: 'location-radius',
			paint: {
				'fill-color': '#8CCFFF',
				'fill-opacity': 0.5
			}
		});

		this.map.addLayer({
			id: 'location-radius-outline',
			type: 'line',
			source: 'location-radius',
			paint: {
				'line-color': '#0094ff',
				'line-width': 3
			}
		});
	}

	findLargestPolygon(multipoly: geojson.Feature<geojson.MultiPolygon>): geojson.Feature<geojson.Polygon> | undefined {
		let largestPoly = undefined;
		let largestArea = 0;

		for (let poly of multipoly.geometry.coordinates) {
			let polygon = turf.polygon(poly);
			let area = turf.area(polygon);
			if (area > largestArea) {
				largestArea = area;
				largestPoly = polygon;
			}
		}

		return largestPoly;
	}

	removeHatchingPatterns() {
		let removeLayers = [];
		for (let layer of this.map.getStyle().layers) {
			if (layer.id.endsWith("-hatch")) {
				removeLayers.push(layer.id);
			}
		}

		removeLayers.forEach(l => this.map.removeLayer(l));
	}

	addHatchingPatternToPolygon(polygon: geojson.Feature<geojson.Polygon>, fillColor: string) {
		this.map.addLayer({
			id: polygon.id + "-hatch",
			type: 'fill',
			source: (polygon.properties ?? { 'source': "" })["source"],
			paint: {
				'fill-opacity': 0.2,
				'fill-pattern': 'diagonal-hatch'
			}
		});
		this.map.addLayer({
			id: polygon.id + "-poly-color",
			type: 'fill',
			source: (polygon.properties ?? { 'source': "" })["source"],
			paint: {
				'fill-opacity': 0.2,
				'fill-color': fillColor,
				'fill-opacity-transition': {
					delay: 0,
					duration: 300
				},
			}
		});
	}

	addPolygon(id: string, polygon: Polygon, fill: string, lineColor: string, lineWidth: number, innerPolygon?: Polygon, tooltip?: string): geojson.Feature<geojson.Polygon> {
		let coordsMap = [polygon.coords.map(c => [c.lon, c.lat])];

		let poly = turf.polygon(coordsMap);

		if (innerPolygon) {
			let innerCoordsMap = [innerPolygon.coords.map(c => [c.lon, c.lat])];
			let innerPoly = turf.polygon(innerCoordsMap);
			let ring = turf.difference(turf.featureCollection([poly, innerPoly], {
				id: id + "-poly"
			}));
			if (ring) {
				if (ring.geometry.type == "MultiPolygon") {
					let largestPoly = this.findLargestPolygon(ring as geojson.Feature<geojson.MultiPolygon>);
					if (largestPoly) {
						poly = largestPoly;
					}
				} else if (ring.geometry.type == "Polygon") {
					poly = ring as geojson.Feature<geojson.Polygon>;
				}
			}
		}

		poly.properties = {
			name: id + "-poly",
			value: "Test Preiskreis",
			id: id + "-poly",
			source: id + "-poly"
		};

		this.map.addSource(id + "-poly", {
			type: 'geojson',
			data: {
				type: 'FeatureCollection',
				features: [poly]
			},
			promoteId: 'id'
		});

		// Add fill layer
		this.map.addLayer({
			id: id + "-poly-color",
			type: 'fill',
			source: id + "-poly",
			paint: {
				'fill-color': fill,
				'fill-opacity': 0.2,
				'fill-opacity-transition': {
					delay: 0,
					duration: 300
				},
			}
		});

		this.map.addLayer({
			id: id + "-poly-hover",
			type: 'fill',
			source: id + "-poly",
			paint: {
				'fill-color': "#ffffff",
				'fill-opacity': 0.0,
				'fill-opacity-transition': {
					delay: 0,
					duration: 300
				},
			}
		});

		this.map.addLayer({
			id: id + "-outline",
			type: 'line',
			source: id + "-poly",
			paint: {
				'line-color': lineColor,
				'line-width': lineWidth
			}
		});

		this.map.on('mouseenter', id + "-poly-hover", (e) => {
			this.map.setPaintProperty(id + "-poly-hover", "fill-opacity", 0.5);
		});

		this.map.on('mouseleave', id + "-poly-hover", () => {
			this.map.setPaintProperty(id + "-poly-hover", "fill-opacity", 0.0);
			this.map.getCanvas().style.cursor = '';

			if (tooltip) {
				this.hoveringPopup.removeClassName("tooltip-visible");
				this.allowShowPopup = false;
			}
		});

		this.map.on('mousemove', id + "-poly-hover", (e) => {
			this.map.getCanvas().style.cursor = 'pointer';

			if (tooltip) {
				this.hoveringPopup
					.setLngLat(e.lngLat)
					.setHTML(tooltip)
					.removeClassName("tooltip-visible");

				this.allowShowPopup = true;
				this.showPopupTimer.next();
			}
		});

		return poly;
	}

	checkIfIntersects(feature: geojson.Feature<geojson.Polygon>, lat: number, lon: number): boolean {
		let pointsWithin = turf.pointsWithinPolygon(turf.point([lon, lat]), feature);
		return pointsWithin.features.length != 0;
	}

	centerMapAroundFeaturePolygon(feature: geojson.Feature<geojson.Polygon>) {
		let latLngBounds = new maplibregl.LngLatBounds();
		for (let pair of feature.geometry.coordinates[0]) {
			latLngBounds.extend({
				lat: pair[1],
				lng: pair[0]
			});
		}
		this.map.fitBounds(latLngBounds);
	}

	centerMapAroundTiles() {
		let bounds = this.getMapBounds();
		this.map.fitBounds(bounds);
	}

	selectPolygon(polygon: geojson.Feature<geojson.Polygon>) {
		this.selectedPoly = polygon;
		this.removeHatchingPatterns();
		this.addHatchingPatternToPolygon(polygon, '#ff0000');
	}

	centerAroundSelectedPoly() {
		if (this.selectedPoly) {
			this.centerMapAroundFeaturePolygon(this.selectedPoly);
		}
	}
}
