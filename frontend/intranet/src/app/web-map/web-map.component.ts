import { AfterViewInit, Component, OnInit } from '@angular/core';
import { PMTiles, Protocol } from "pmtiles";
import maplibregl from "maplibre-gl";
import { getFile, saveFile } from '../utilities/indexeddb-helper';
import { IndexedDBMapSource, loadPMTiles } from './indexed-db-map-source';

@Component({
	selector: 'app-web-map',
	imports: [],
	templateUrl: './web-map.component.html',
	styleUrl: './web-map.component.scss'
})
export class WebMapComponent implements AfterViewInit {

	constructor() {
	}

	ngAfterViewInit(): void {
		this.initMap();
	}

	initMap() {
		fetch("map/style.json").then(d => d.json()).then(async json => {

			const url = "/map/planet.pmtiles";
			const buffer = await loadPMTiles(url);
			console.log(buffer.byteLength);
			const source = new IndexedDBMapSource(buffer, url);
			const pmtiles = new PMTiles(source);

			const protocol = new Protocol();
			protocol.add(pmtiles);
			maplibregl.addProtocol("pmtiles", protocol.tile.bind(protocol));

			json.sprite = json.sprite.replace("{hostname}", location.hostname)
			json.glyphs = json.glyphs.replace("{hostname}", location.hostname)

			const map = new maplibregl.Map({
				container: "map",
				style: json,
				center: [12.4668, 48.2163],
				zoom: 13
			});
			map.addControl(new maplibregl.NavigationControl());
			map.resize();
		});

	}
}
