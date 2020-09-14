/**
 * Redistribution and use in source and binary forms, with or without
 * modification, are permitted provided that the following conditions are met:
 *
 * - Redistributions of source code must retain the above copyright notice, this
 *   list of conditions and the following disclaimer.
 *
 * - Redistributions in binary form must reproduce the above copyright notice,
 *   this list of conditions and the following disclaimer in the documentation
 *   and/or other materials provided with the distribution.
 *
 * THIS SOFTWARE IS PROVIDED BY THE COPYRIGHT HOLDERS AND CONTRIBUTORS "AS IS"
 * AND ANY EXPRESS OR IMPLIED WARRANTIES, INCLUDING, BUT NOT LIMITED TO, THE
 * IMPLIED WARRANTIES OF MERCHANTABILITY AND FITNESS FOR A PARTICULAR PURPOSE ARE
 * DISCLAIMED. IN NO EVENT SHALL MICHAEL BOSTOCK BE LIABLE FOR ANY DIRECT,
 * INDIRECT, INCIDENTAL, SPECIAL, EXEMPLARY, OR CONSEQUENTIAL DAMAGES (INCLUDING,
 * BUT NOT LIMITED TO, PROCUREMENT OF SUBSTITUTE GOODS OR SERVICES; LOSS OF USE,
 * DATA, OR PROFITS; OR BUSINESS INTERRUPTION) HOWEVER CAUSED AND ON ANY THEORY
 * OF LIABILITY, WHETHER IN CONTRACT, STRICT LIABILITY, OR TORT (INCLUDING
 * NEGLIGENCE OR OTHERWISE) ARISING IN ANY WAY OUT OF THE USE OF THIS SOFTWARE,
 * EVEN IF ADVISED OF THE POSSIBILITY OF SUCH DAMAGE.
 *
 * @library    leaflet : © 2010–2014 Vladimir Agafonkin, 2010–2011 CloudMade. Maps © OpenStreetMap contributors. All rights reserved.
 * @license    Copyright (c) 2020, Vincent Soh All rights reserved.
 * @release    1.0
 */
 
 define(["jquery" , "text!./graphics-leaflet-cluster.css", "text!./lib/leaflet.css","text!./lib/MarkerCluster.css","text!./lib/MarkerCluster.Default.css", "./lib/leaflet","./lib/leaflet.markercluster-src"], function ( $, cssContent, cssLeaflet, cssLeaflet2, cssLeaflet3 ) {

	'use strict';

	// Extension style sheet
	$("<style>").html(cssContent).appendTo("head");

	// Leaflet style sheet (fix Leaflet background images URL)
	var re = /url\(images/gi; 
	cssLeaflet = cssLeaflet.replace(re, "url(/extensions/graphics-deltaviz-leaflet/lib/images");
	$("<style>").html(cssLeaflet).appendTo("head");
    $("<style>").html(cssLeaflet2).appendTo("head");
    $("<style>").html(cssLeaflet3).appendTo("head");

	return {

		// New object properties
		initialProperties: {
			version: 1.01,
			qHyperCubeDef: {
				qDimensions: [],
				qMeasures: [],
				qInterColumnSortOrder : [],
				qInitialDataFetch: [{
					qWidth: 5,
					qHeight: 2000
				}]
			}
		},

		// Property panel
		definition: {
			type: "items",
			component: "accordion",
			items: {
				dimensions: {
					uses: "dimensions",
					min: 1,
					max: 1
				},
				measures: {
					uses: "measures",
					min: 2,
					max: 4
				},
				sorting: {
					uses: "sorting"
				},
				settings: {
					uses: "settings"
				}
			}
		},
        
        support : {
			snapshot: true
		},

		// Snapshot availability
		// snapshot: {
			// canTakeSnapshot: true
		// },

		// Object rendering
		paint: function ( $element, layout ) {

			// Create a new array that contains dimensions labels
			var dimensions = layout.qHyperCube.qDimensionInfo.map( function(d) {
				return {
					"title":d.qFallbackTitle
					}
			});

			// Create a new array that contains measures labels & bounds
			var measures = layout.qHyperCube.qMeasureInfo.map( function(d) {
				return {
					"title":d.qFallbackTitle,
					"min":d.qMin,
					"max":d.qMax
					}
			});

			// Create a new array for our extension with a row for each row in the qMatrix
			var qmDimension=0, qmLatitude=1, qmLongitude=2, qmValue=3, qmColor=4;
			var dataL = layout.qHyperCube.qDataPages[0].qMatrix.map( function(d) {
				// for each element in the matrix, create a new object that has a property for dimensions and measures
				return {
					"item": d[qmDimension].qIsOtherCell ? layout.qHyperCube.qDimensionInfo[qmDimension].othersLabel : d[qmDimension].qText,
					"poi" : L.latLng(d[qmLatitude].qNum, d[qmLongitude].qNum),
					"size" : measures.length > 2 ? Math.max(50,Math.ceil(100 * d[qmValue].qNum/measures[2].max)) : 50,
					"fillcolor" : measures.length > 3 ? d[qmColor].qText : "green",
					"marker" : null,
					// Used for selection
					"dimensionid" : d[qmDimension].qIsOtherCell ? null : d[qmDimension].qElemNumber,
					"selected" : 0
					}
				})
			;

			// Suppress null values
			for (var cell = dataL.length-1; cell >= 0; --cell) {
				if (dataL[cell].size == 0)
					dataL.splice(cell, 1);
			}

 			// Map element  
			var width = $element.width();
			var height = $element.height();
			var id = "graphics-leaflet-cluster" + layout.qInfo.qId;
			if (document.getElementById(id)) {
				$("#" + id).remove();
			}
			$element.append($('<div />;').attr("id", id).width(width).height(height));

			// Extension properties edit mode 
			var editMode = angular.element($element).scope().$parent.$parent.editmode;

			// Leaflet rendering
			var self = this;
			leafletVizcluster (
				self,
				dataL, 
				dimensions,
				measures, 
				width, 
				height,
				id, 
				editMode
			);
            
            return qlik.Promise.resolve();

		} // Paint

	}; // Extension function

} ); // Extension definition

var leafletVizcluster = function ( self, dataL, dimensions, measures, width, height, id, editMode ) { 

	// Set up the map
	var map = new L.Map(id);

	// Do not interact with map while editing extension properties
	if ( editMode ) {
		map.dragging.disable();
	}

	// Compute map bounds
	var southWest = L.latLng(measures[0].min, measures[1].min),
		northEast = L.latLng(measures[0].max, measures[1].max),
		mapBounds = L.latLngBounds(southWest, northEast)
	;

	// Adjust map size & zoom
	var maxZoom = 17;
	if ( dataL.length > 1 ) {
		// View all POIs
		map.fitBounds(mapBounds);
	} else if ( dataL.length == 1 ) {
		// Zoom on single POI
		map.setView( dataL[0].poi, maxZoom);
	} else {
		// You are certainly somewhere on earth...
		map.fitWorld();
	}
	var minZoom = map.getBoundsZoom(map.getBounds());

	// Adjust zoom
	if (maxZoom - minZoom >= 5) {
		// Large map : get a little bit closer at first glance
		map.zoomIn(1,{"animate":true});
	} else if (minZoom >= maxZoom) {
		// Narrow map : get some altitude... 
		minZoom--;
		map.zoomOut(1,{"animate":false});
	};
    
    
    
    var overlayLayer = new L.LayerGroup();
    var clustermarkers = L.markerClusterGroup();
    
	for (var row = 0; row < dataL.length; ++row) {
		// Each POI is drawn as an up to 100m circle
		dataL[row].marker = new L.circle( dataL[row].poi, dataL[row].size, {
			"stroke": false,
			"fillColor": dataL[row].fillcolor,
			"fillOpacity": 0.5
		});
		// dataL[row].marker.addTo(overlayLayer);
        clustermarkers.addLayer(dataL[row].marker);
	}
    
    // map.addLayer(clustermarkers);
    clustermarkers.addTo(overlayLayer);
    
    // var markersize_mult=10;
    // map.on('zoomend', function() {
        // var currentZoom = map.getZoom();
        // if(currentZoom >= 15) {
          // markersize_mult = 1;
        // }
        // else {
          // markersize_mult = 10;
        // };
        // for (var row = 0; row < dataL.length; ++row) {
            // // Each POI is drawn as an up to 100m circle
            // dataL[row].marker.setRadius(dataL[row].size*markersize_mult);
        // };
    // });

	// Show metric scale
	L.control.scale({imperial:false}).addTo(map);

	// Define base tile layers
	// See samples at : http://leaflet-extras.github.io/leaflet-providers/preview/
     var OneMap = L.tileLayer('https://maps-{s}.onemap.sg/v3/Default/{z}/{x}/{y}.png', {
		"minZoom": minZoom, "maxZoom": maxZoom, attribution: '<img src="https://docs.onemap.sg/maps/images/oneMap64-01.png" style="height:20px;width:20px;"/> New OneMap | Map data &copy; contributors, <a href="http://SLA.gov.sg">Singapore Land Authority</a>'
	});
    var OneMapNight = L.tileLayer('https://maps-{s}.onemap.sg/v3/Night/{z}/{x}/{y}.png', {
		"minZoom": minZoom, "maxZoom": maxZoom, attribution: '<img src="https://docs.onemap.sg/maps/images/oneMap64-01.png" style="height:20px;width:20px;"/> New OneMap | Map data &copy; contributors, <a href="http://SLA.gov.sg">Singapore Land Authority</a>'
	});
    var OneMapGrey = L.tileLayer('https://maps-{s}.onemap.sg/v3/Grey/{z}/{x}/{y}.png', {
		"minZoom": minZoom, "maxZoom": maxZoom, attribution: '<img src="https://docs.onemap.sg/maps/images/oneMap64-01.png" style="height:20px;width:20px;"/> New OneMap | Map data &copy; contributors, <a href="http://SLA.gov.sg">Singapore Land Authority</a>'
	});
    var OneMapOriginal = L.tileLayer('https://maps-{s}.onemap.sg/v3/Original/{z}/{x}/{y}.png', {
		"minZoom": minZoom, "maxZoom": maxZoom, attribution: '<img src="https://docs.onemap.sg/maps/images/oneMap64-01.png" style="height:20px;width:20px;"/> New OneMap | Map data &copy; contributors, <a href="http://SLA.gov.sg">Singapore Land Authority</a>'
	});    
    var OpenStreetMap = L.tileLayer('http://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
		"minZoom": minZoom, "maxZoom": maxZoom, attribution: 'contributeurs &copy; <a href="http://www.openstreetmap.org/copyright">OpenStreetMap</a>'
	});
	var OpenStreetMap_BlackAndWhite = L.tileLayer('http://{s}.www.toolserver.org/tiles/bw-mapnik/{z}/{x}/{y}.png', {
		"minZoom": minZoom, "maxZoom": maxZoom, attribution: 'contributeurs &copy; <a href="http://www.openstreetmap.org/copyright">OpenStreetMap</a>'
	});
	var Thunderforest_Transport = L.tileLayer('http://{s}.tile.thunderforest.com/transport/{z}/{x}/{y}.png', {
		"minZoom": minZoom, "maxZoom": maxZoom, attribution: '&copy; <a href="http://www.opencyclemap.org">OpenCycleMap</a>, contributeurs &copy; <a href="http://www.openstreetmap.org/copyright">OpenStreetMap</a>'
	});
	var Esri_WorldStreetMap = L.tileLayer('http://server.arcgisonline.com/ArcGIS/rest/services/World_Street_Map/MapServer/tile/{z}/{y}/{x}', {
		"minZoom": minZoom, "maxZoom": maxZoom, attribution: '&copy; Esri &mdash; Sources: Esri, HERE, DeLorme, USGS, Intermap, increment P Corp., NRCAN, METI, TomTom, MapmyIndia, &copy; contributeurs OpenStreetMap & GIS Community'
	});
	var Esri_WorldImagery = L.tileLayer('http://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}', {
		"minZoom": minZoom, "maxZoom": maxZoom, attribution: '&copy; Esri &mdash; Sources: Esri, i-cubed, USDA, USGS, AEX, GeoEye, Getmapping, Aerogrid, IGN, IGP, UPR-EGP, & GIS Community'
	});

	// Setup data layer
	// var overlayLayer = new L.LayerGroup();
	// for (var row = 0; row < dataL.length; ++row) {
		// // Each POI is drawn as an up to 100m circle
		// dataL[row].marker = new L.circle( dataL[row].poi, dataL[row].size * markersize_mult, {
			// "stroke": false,
			// "fillColor": dataL[row].fillcolor,
			// "fillOpacity": 0.5
		// });
		// dataL[row].marker.addTo(overlayLayer);
	// }

	// Set default layers
	map.addLayer(OneMap);
	map.addLayer(overlayLayer);
	map.attributionControl.setPrefix('&copy;&nbspdeltaViz&nbsp;&copy;&nbsp;Vincent Soh&nbsp;<a href="http://leafletjs.com/">Leaflet</a>');

	// Set layers control
	var baseLayersList = {		
        "OneMap" : OneMap,
        "OneMap Night" : OneMapNight,
        "OneMap Grey" : OneMapGrey,
        "OneMap Original" : OneMapOriginal,
        "Open Street Map" : OpenStreetMap,
		"Open Street Map Black & White": OpenStreetMap_BlackAndWhite,
		"Thunderforest Transport" : Thunderforest_Transport,
		"ESRI Streets map" : Esri_WorldStreetMap,
		"ESRI Sattelite" : Esri_WorldImagery
	};
	var overlayLayersList = [];
	overlayLayersList[dimensions[0].title] = overlayLayer;
	L.control.layers(baseLayersList,overlayLayersList).addTo(map);

	// User selection
	function onMapClick(e) {

		// Nothing to find
		if (self.selectionsEnabled == false || dataL.length < 1) 
			return; 

		// Search nearest Point of interest
		var nearest, d2min, d2;
		for (var row = 0; row < dataL.length; ++row) {
			// Compute plane square distance (faster than Haversine formula) for each POI
			d2 = (e.latlng.lat - dataL[row].poi.lat) * (e.latlng.lat - dataL[row].poi.lat)
			   + (e.latlng.lng - dataL[row].poi.lng) * (e.latlng.lng - dataL[row].poi.lng);
			if (row == 0 || d2 < d2min ) {
				nearest = row;
				d2min = d2;
			}
		}

		// User click inside POI ? (maximum real distance is circle size in meters)
		if ( e.latlng.distanceTo(dataL[nearest].poi) <= dataL[nearest].size ) {

			// No dimension here...
			if ( dataL[nearest].dimensionid === null || dataL[nearest].item === undefined)
				return;

			// Toggle selection (visual feedback)
			dataL[nearest].selected = 1-dataL[nearest].selected;
			if ( dataL[nearest].selected ) {
				// Highlight selected POI
				dataL[nearest].marker.setStyle({fillOpacity: 0.75, stroke: true, weight:2, color: "black"});
				dataL[nearest].marker.bringToFront();
			} else {
				// Unselect POI
				dataL[nearest].marker.setStyle({fillOpacity: 0.5, stroke: false});
				dataL[nearest].marker.bringToBack();
			} 

			// Toggle selection (Sense)
			var dim = 0, value = dataL[nearest].dimensionid;
			self.selectValues(dim, [value], true);

		} 
	}

	// Handle user selections
	map.on('click', onMapClick);

}; // leafletVizcluster
