/* Auteur : Corentin ROBIN */

// Version : 20 juin 2023
// Les coordonnées sont des tableaux [x, y] pour des raisons de performance

// Grosso modo 40 heures pour arriver à la première mise à jour du 29 novembre 2020

// Données : http://geojson.xyz/
// Climat : http://koeppen-geiger.vu-wien.ac.at/present.htm (koeppen_generator.php découpe le CSV et en faire un JSON plus petit)
// Drapeaux : https://github.com/stefangabos/world_countries/tree/master/flags/24x24
// Langues et monnaies : https://github.com/annexare/Countries/blob/master/dist/countries.json
// Noms complets dans langues : https://github.com/annexare/Countries/blob/master/dist/languages.all.json

// On ne fait pas de temps-réel : on redessine uniquement quand c'est nécessaire

// Dans les fichiers geojson, les valeurs numériques de -99 signifient N/A

Number.prototype.toRadians = function()
{
	return this * Math.PI / 180;
}

Number.prototype.toFormattedInteger = function()
{
	var array = String(this).split("").reverse(), i, c = 0;
	var output = [];

	for(i = 0; i < array.length; i++)
	{
		output.push(array[i]);
		if((i + 1) % 3 == 0) output.push(" ");
	}

	return output.reverse().join("");
}

// latitude ou longitude
Number.prototype.toSubUnits = function()
{
	var degrees = parseInt(this),
		decimals = this - degrees,
		minutes = decimals * 60,
		seconds = (minutes - parseInt(minutes)) * 60;

	return Math.abs(degrees) + "°" + Math.abs(parseInt(minutes)) + "′" + Math.abs(parseInt(seconds)) + "″";	
}

Array.prototype.toFormattedCoordinates = function()
{
	return this[0].toSubUnits() + (this[0] < 0 ? " S" : " N") + " , " + this[1].toSubUnits() + (this[1] < 0 ? " O" : " E");
}

Number.prototype.rounded = function(p)
{
	var P = Math.pow(10, p);

	return Math.round(this * P) / P;
}

// [longitude, latitude] en degrés vers [x, y] en pixels
Array.prototype.toMercator = function()
{
	return [
		Carte.width * (this[0] + 180) / 360,
		Carte.height / 2 - (Carte.width / (2 * Math.PI)) * Math.log(Math.tan(Math.PI / 4 + this[1].toRadians() / 2))
	];
}

var Carte =
{
	label : "Carte v20.06.23 - © 2023 Corentin ROBIN",
	width : 0,
	height : 0,
	scale : 1,
	position : [0, 0],
	canvas : null,
	selectedElement : null,

	objects : [],
	objectUnderMouse : null,
	countries : null,
	cities : null,
	languages : null,
	languagesNames : null,

	populationRange : [],
	wealthRange : [],
	cityPopulationRange : [],

	climatePoints : null,

	// récupérées à la pipette sur /images/map.png
	climateColors :
	{
		"Af" : "#930101",
		"Am" : "#fe0000",
		"As" : "#fe9a9a",
		"Aw" : "#ffcfcf",
		"BWk" : "#fffe65",
		"BWh" : "#ffcf00",
		"BSk" : "#ceaa54",
		"BSh" : "#cf8f14",
		"Cfa" : "#003000",
		"Cfb" : "#015001",
		"Cfc" : "#007800",
		"Csa" : "#00fe00",
		"Csb" : "#95ff00",
		"Csc" : "#cbff00",
		"Cwa" : "#b46500",
		"Cwb" : "#966604",
		"Cwc" : "#5e4002",
		"Dfa" : "#300030",
		"Dfb" : "#650164",
		"Dfc" : "#cb00cc",
		"Dfd" : "#c71587",
		"Dsa" : "#fe6cfd",
		"Dsb" : "#ffb6ff",
		"Dsc" : "#e6cafd",
		"Dsd" : "#cacccb",
		"Dwa" : "#ccb6ff",
		"Dwb" : "#997cb2",
		"Dwc" : "#8a59b2",
		"Dwd" : "#6d24b3",
		"EF" : "#6396ff",
		"ET" : "#65ffff"
	},
	climateInformation :
	{
		"A" : "equatorial",
		"B" : "arid",
		"C" : "warm temperate",
		"D" : "snow",
		"E" : "polar",
		"W" : "desert",
		"S" : "steppe",
		"f" : "fully humid",
		"s" : "summer dry",
		"w" : "winter dry",
		"m" : "monsoonal",
		"h" : "hot arid",
		"k" : "cold arid",
		"a" : "hot summer",
		"b" : "warm summer",
		"c" : "cool summer",
		"d" : "continental",
		"F" : "polar frost",
		"T" : "polar tundra"
	},

	mostPopulatedCountry : null,
	wealthiestCountry : null,

	renderingTime : 0,

// https://codepen.io/amir-s/pen/jzqZdG?editors=0010
	mousePosition : [0, 0],
	mouseIsDown : false,
	movingElement : false,
	selectionStateChanged : false, // pour ne faire le rendu que si un élément vient d'être sélectionné ou désélectionné

	// options IHM
	fullScreen : false,
	showClimatePoints : true,
	dynamicColoring : false,
	dynamicColoringRelation : "population", // population ou wealth
	showCities : false,
	showCirclesOfLatitude : false,
	showGarland : false,
	showBorders : true,

	circlesOfLatitude :
	[
		["Artic Circle", 66.563],
		["Tropic of Cancer", 23.437],
		["Equator", 0],
		["Tropic of Capricorn", -23.437], 
		["Antarctic Cirlce", -66.563]
	],

	settings :
	{
		mapBackgroundColor : "#040442",
		countryStrokeColor : "#ffffff",
		countryFillColor : "rgba(5, 56, 138, 0.5)",//"rgba(4, 0, 127, 0.6)",//"#000638",
		cityFillColor : "#abeef7",

		mapGarlandBackgroundColor : "#000130",
		countryGarlandStrokeColor : "#ffffff",
		countryGarlandFillColor : "rgba(4, 44, 108, 0.5)",//"rgba(4, 0, 127, 0.6)",//"#000638",
		cityGarlandFillColor : "#ffecaf",

		selectionColor : "rgba(50, 50, 50, 0.8)",//"#404040",

		climatePointSize : 20,
	},

	// chargement des deux fichiers geojson par XHR
	load : function(callback)
	{
		Carte.showLoadingMessage("Loading country geometry...");

		var request = new XMLHttpRequest();

		request.onload = function()
		{
			Carte.countries = JSON.parse(this.responseText).features;

			Carte.showLoadingMessage("Loading city data...");

			var secondRequest = new XMLHttpRequest();

			secondRequest.onload = function()
			{
				Carte.cities = JSON.parse(this.responseText).features;

				Carte.showLoadingMessage("Loading climate data...");

				var thirdRequest = new XMLHttpRequest();

				thirdRequest.onload = function()
				{
					Carte.climatePoints = JSON.parse(this.responseText).points;

					Carte.generateClimateInformation();

					Carte.showLoadingMessage("Loading country languages...");

					var fourthRequest = new XMLHttpRequest();

					fourthRequest.onload = function()
					{
						Carte.languages = JSON.parse(this.responseText);

						Carte.showLoadingMessage("Loading native languages...");

						var fifthRequest = new XMLHttpRequest();

						fifthRequest.onload = function()
						{
							Carte.languagesNames = JSON.parse(this.responseText);

							Carte.generateLanguageInformation();

							document.querySelector("div.loading").classList.add("hidden");

							callback();
						}

						fifthRequest.open("GET", "/carte/data/languages.all.json");
						fifthRequest.send();

						callback();
					}

					fourthRequest.open("GET", "/carte/data/country_languages.json");
					fourthRequest.send();

					callback();
				}

				thirdRequest.open("GET", "/carte/data/climate.json");
				thirdRequest.send();

				callback();
			}

			// ensuite on charge les villes
			secondRequest.open("GET", "/carte/data/ne_50m_populated_places_simple.geojson");
			secondRequest.send();
		}

		// on charge d'abord la géométrie des pays
		request.open("GET", "/carte/data/ne_110m_admin_0_countries.geojson");
		request.send();
	},

	randomInteger : function(a, b)
	{
		return Math.round(Math.random() * (b - a) + a);
	},

	// pour savoir si un point se situe dans un polygone
	// http://alienryderflex.com/polygon/
	pointInPolygon : function(point, points)
	{
		var   i, j=points.length-1, point ;
		var  oddNodes=false      ;

		var x = point[0],
			y = point[1];

		for (i=0; i<points.length; i++)
		{
			if ((points[i][1]< y && points[j][1]>=y
			||   points[j][1]< y && points[i][1]>=y)
			&&  (points[i][0]<=x || points[j][0]<=x)) {
			oddNodes^=(points[i][0]+(y-points[i][1])/(points[j][1]-points[i][1])*(points[j][0]-points[i][0])<x); }


			j=i;
		}

		return oddNodes;
	},

	// https://stackoverflow.com/questions/16285134/calculating-polygon-area
	polygonArea : function(vertices)
	{
	    var total = 0;

	    for (var i = 0, l = vertices.length; i < l; i++) {
	      var addX = vertices[i][0];
	      var addY = vertices[i == vertices.length - 1 ? 0 : i + 1][1]
	      var subX = vertices[i == vertices.length - 1 ? 0 : i + 1][0];
	      var subY = vertices[i][1];

	      total += (addX * addY * 0.5);
	      total -= (subX * subY * 0.5);
	    }

	    return Math.abs(total);
	},

	averagePoint : function(points)
	{
		var i, a = [0, 0];

		for(i = 0; i < points.length; i++)
		{
			a[0] += points[i][0];
			a[1] += points[i][1];
		}

		a = [a[0] / points.length, a[1] / points.length];

		return a;
	},

	// https://en.wikipedia.org/wiki/Distance
	distance : function(p1, p2)
	{
		return Math.sqrt( Math.pow(p2[0] - p1[0], 2) + Math.pow(p2[1] - p1[1], 2) );
	},

	getObjectUnderMouse : function()
	{
		var i, j, count, object;
		var adjustedMousePosition = [Carte.mousePosition[0] * window.devicePixelRatio, Carte.mousePosition[1] * window.devicePixelRatio];

		var countryUnderMouse = null, cityUnderMouse = null;

		for(i = 0; i < Carte.objects.length; i++)
		{
			object = Carte.objects[i];

			if(object.type == "country")
			{
				count = 0;

				for(j = 0; j < object.polygons.length; j++)
				{
					points = object.polygons[j];

					count += Carte.pointInPolygon(adjustedMousePosition, points) ? 1 : 0;
				}

				if(count > 0) countryUnderMouse = object;
			}

			// simple calcul de distance pour les villes
			// si on affiche pas les villes, pas besoin de savoir si l'une d'entre elles est sous la souris
			else if(object.type == "city" && Carte.showCities)
			{
				if(Carte.distance(adjustedMousePosition, object.position) < object.radius) cityUnderMouse = object;
			}
		}

		// la ville est prioritaire sur le pays
		if(cityUnderMouse != null) Carte.objectUnderMouse = cityUnderMouse;
		else if(countryUnderMouse != null) Carte.objectUnderMouse = countryUnderMouse;
		else Carte.objectUnderMouse = null;
	},

	getHue : function(ratio)
	{
		// en hsl, de 180 à 360 degrés, on va du bleu au rouge, froid au chaud, faible au fort
		var range = [180, 360];

		return "hsl(" + (Math.sqrt(ratio) * (range[1] - range[0]) + range[0]) + ", 50%, 50%)";
	},

	getCountryColor : function(object)
	{
		if(Carte.objectUnderMouse == object) return Carte.settings.selectionColor;

		else if(!Carte.dynamicColoring) return Carte.showGarland ? Carte.settings.countryGarlandFillColor : Carte.settings.countryFillColor;

		else
		{
			switch(Carte.dynamicColoringRelation)
			{
				// on utilise la racine carrée, pour avoir une progression dans les couleurs moins forte
				case "population" : return Carte.getHue(object.properties.pop_est / (Carte.populationRange[1] - Carte.populationRange[0])) ; break;
				case "wealth" : return Carte.getHue((object.properties.gdp_md_est / object.properties.pop_est) / (Carte.wealthRange[1] - Carte.wealthRange[0])) ; break;
				default : return Carte.settings.countryFillColor ; break;
			}
		}
	},

	getCountryClimate : function(object)
	{
		var polygons = object.polygons, climates = [], point, climatePoint, i, j;

		for(i = 0; i < polygons.length; i++)
		{
			polygon = polygons[i];

			for(j = 0; j < Carte.climatePoints.length; j += 1)
			{
				climatePoint = Carte.climatePoints[j];

				// on ne fait les calculs que si le climat testé n'a pas déjà été trouvé, pour des raisons de perfomance
				if(climates.indexOf(climatePoint[2]) == -1)
				{
					point = [climatePoint[1], climatePoint[0]].toMercator();
					if(Carte.pointInPolygon(point, polygon)) climates.push(climatePoint[2]);
				}
			}
		}

		return climates;
	},

	getCountryNativeName : function(object)
	{
		return typeof Carte.languages[object.properties.iso_a2] == "undefined" ? object.properties.name : Carte.languages[object.properties.iso_a2].native;
	},

	calculateStatistics : function()
	{
		var maximumPopulation = 0, minimumPopulation = 1e+10,
			maximumWealth = 0, minimumWealth = 1e+10,
			cityMaximumPopulation = 0, cityMinimumPopulation = 1e+10, country, city, i;

		var pop_est, gdp_md_est, pop_max;

		for(i = 0; i < Carte.countries.length; i++)
		{
			country = Carte.countries[i];
			pop_est = country.properties.pop_est;
			gdp_md_est = country.properties.gdp_md_est;
			gdp_per_capita = gdp_md_est / pop_est;


			if(pop_est < minimumPopulation && pop_est != -99) minimumPopulation = pop_est;
			if(pop_est > maximumPopulation && pop_est != -99) maximumPopulation = pop_est;

			if(gdp_per_capita < minimumWealth && gdp_md_est != -99) minimumWealth = gdp_per_capita;
			if(gdp_per_capita > maximumWealth && gdp_md_est != -99) maximumWealth = gdp_per_capita;
		}

		for(i = 0; i < Carte.cities.length; i++)
		{
			city = Carte.cities[i];
			pop_max = city.properties.pop_max;

			if(pop_max < cityMinimumPopulation && pop_max != -99) cityMinimumPopulation = pop_max;
			if(pop_max > cityMaximumPopulation && pop_max != -99) cityMaximumPopulation = pop_max;
		}

		Carte.populationRange = [minimumPopulation, maximumPopulation];
		Carte.wealthRange = [minimumWealth, maximumWealth];
		Carte.cityPopulationRange = [cityMinimumPopulation, cityMaximumPopulation];
	},

	// principalement pour convertir les coordonées géographiques en coordonnées cartésiennes, avec la projection de Mercator
	calculate : function()
	{
		var i, j, k, l, x, y, array, table, point, points, type, city, country;

		Carte.objects = [];

		Carte.mostPopulatedCountry = Carte.countries[0]; // arbitraire
		Carte.wealthiestCountry = Carte.countries[0];

		for(i = 0; i < Carte.countries.length; i++)
		{
			country = Carte.countries[i];
			type = country.geometry.type;

			polygons = country.geometry.coordinates;

			array = [];

			if(Carte.mostPopulatedCountry.properties.pop_est < country.properties.pop_est) Carte.mostPopulatedCountry = country;
			if(Carte.wealthiestCountry.properties.gdp_md_est < country.properties.gdp_md_est) Carte.wealthiestCountry = country;

			for(j = 0; j < polygons.length; j++)
			{
				points = polygons[j];

				table = [];

				// on peut avoir directement un polygone (État avec un seul territoire), ou un tableau de polygones (exemple : la France métro, et la Guyane)
				for(k = 0; k < points.length; k++)
				{
					if(points[k][0].constructor.name == "Number")
					{
						point = [points[k][0], points[k][1]].toMercator();

						table.push(point);
					}

					else
					{
						for(l = 0; l < points[k].length; l++)
						{
							point = [points[k][l][0], points[k][l][1]].toMercator();

							table.push(point);
						}
					}
				}

				array.push(table);
			}

			Carte.objects.push({ type : "country", properties : Carte.countries[i].properties, polygons : array, isUnderMouse : false, climate : null });
		}

		for(i = 0; i < Carte.cities.length; i++)
		{
			city = Carte.cities[i];
			position = [city.geometry.coordinates[0], city.geometry.coordinates[1]].toMercator();

			var radius = Math.sqrt(city.properties.pop_max / (Carte.cityPopulationRange[1] - Carte.cityPopulationRange[0])) * 15 + 2;
			radius = Math.max(4, radius);

			Carte.objects.push({ type : "city", properties : city.properties, position : position, radius : radius, isUnderMouse : false });
		}
	},

	toggleFullScreen(fullScreen)
	{
		var element = document.documentElement;

		if(fullScreen)
		{
			if (element.requestFullscreen) {
			element.requestFullscreen();
			} else if (element.webkitRequestFullscreen) { /* Safari */
			element.webkitRequestFullscreen();
			} else if (element.msRequestFullscreen) { /* IE11 */
			element.msRequestFullscreen();
			}
		}

		else
		{
			if (document.exitFullscreen) {
			document.exitFullscreen();
			} else if (document.webkitExitFullscreen) { /* Safari */
			document.webkitExitFullscreen();
			} else if (document.msExitFullscreen) { /* IE11 */
			document.msExitFullscreen();
			}
		}
	},

	draw : function()
	{
		var t0 = performance.now();

		var i, j, k, polygons, points, point, object;

		var context = Carte.context;

		var countryClimates;

		context.setLineDash([5, 10]);

		context.fillStyle = Carte.showGarland ? Carte.settings.mapGarlandBackgroundColor : Carte.settings.mapBackgroundColor;
		context.strokeStyle = Carte.settings.countryStrokeColor;

		context.save();

		context.clearRect(0, 0, Carte.width, Carte.height);
		context.fillRect(0, 0, Carte.width, Carte.height);

		// on dessine les points de climat si demandé
		if(Carte.showClimatePoints) Carte.drawClimatePoints();

		var objectUnderMouse = null;

		for(i = 0; i < Carte.objects.length; i++)
		{
			object = Carte.objects[i];
			points = object.points;

			// on dessine les pays
			if(object.type == "country")
			{
				context.fillStyle = Carte.getCountryColor(object);

				for(j = 0; j < object.polygons.length; j++)
				{
					context.beginPath();

					points = object.polygons[j];

					context.moveTo(points[0][0], points[0][1]);

					for(k = 1; k < points.length; k++)
					{
						context.lineTo(points[k][0], points[k][1]);
					}

					context.closePath();

					context.fill();

					if(Carte.showBorders) context.stroke();

					if(object.isUnderMouse) objectUnderMouse = object;

					if(!Carte.showClimatePoints && !Carte.showCities)
					{
						// par exemple on écrira France au dessus de la France métropolitaine, mais au-dessus de la Guyane aussi
						context.save();

						context.clip();

						var centerPoint = Carte.averagePoint(points);

						if(Carte.showGarland)
						{
							context.shadowBlur = 15;
							context.shadowColor = Carte.settings.cityGarlandFillColor;
						}

						context.fillStyle = "#ebebeb";

						// la taille de la police est fonction de la surface du pays
						// on prend la surface de la représentation de Mercator, pas la sufrace réelle ; le résultat étant plus graphique que lisible
						// on prend la racine carrée de la surface pour avoir une évolution linéaire
						var fontSize = Math.sqrt(Carte.polygonArea(points)) * 0.5;
						context.font = fontSize + "px Cardo-Regular";

						var label = Carte.getCountryNativeName(object);
						var labelWidth = context.measureText(label).width;
						context.fillText(label, centerPoint[0] - labelWidth / 2, centerPoint[1] + fontSize / 3);

						context.restore();
					}
				}
			}


			else if(object.type == "city" && Carte.showCities)
			{
				context.save();
				
				if(Carte.showGarland)
				{
					context.shadowBlur = 20;
					context.shadowColor = Carte.settings.cityGarlandFillColor;
					context.fillStyle = Carte.settings.cityGarlandFillColor;
				}

				else context.fillStyle = Carte.settings.cityFillColor;

				context.beginPath();
				context.arc(object.position[0], object.position[1], object.radius, 0, 2 * Math.PI);
				context.fill();
				context.restore();
			}
		}

		// https://en.wikipedia.org/wiki/Circle_of_latitude
		if(Carte.showCirclesOfLatitude)
		{
			context.save();
			context.setLineDash([10, 10]);
			
			context.strokeStyle = "white";

			for(i = 0; i < Carte.circlesOfLatitude.length; i++)
			{
				point = [0, Carte.circlesOfLatitude[i][1]].toMercator();

				context.shadowBlur = 20;
				context.shadowColor = "white";

				context.beginPath()
				context.moveTo(0, point[1]);
				context.lineTo(Carte.width, point[1]);
				context.stroke();

				context.shadowBlur = 0;

				context.fillStyle = "white";
				context.font = "20px Cardo-Regular";
				context.fillText(Carte.circlesOfLatitude[i][0], 10, point[1] - 10);
			}

			context.restore();
		}

		context.fillStyle = "white";
		context.font = "20px Cardo-Regular";
		labelWidth = context.measureText(Carte.label).width;
		context.fillText(Carte.label, Carte.width - labelWidth - 20, Carte.height - 20);

		context.restore();

		Carte.renderingTime = performance.now() - t0;
	},

	drawClimatePoints : function()
	{
		var context = Carte.context, point, location, i;

		context.save();

		for(i = 0; i < Carte.climatePoints.length; i++)
		{
			point = Carte.climatePoints[i];
			location = [point[1], point[0]].toMercator();

			if(Carte.showGarland)
			{
				context.shadowBlur = 10;
				context.shadowColor = Carte.climateColors[point[2]];
			}

			context.fillStyle = Carte.climateColors[point[2]];

			context.beginPath();
			context.rect(location[0] - Carte.settings.climatePointSize / 2, location[1] - Carte.settings.climatePointSize / 2, Carte.settings.climatePointSize, Carte.settings.climatePointSize);
			//context.arc(location[0], location[1], Carte.settings.climatePointSize / 2, 0, 2 * Math.PI);
			context.fill();
		}

		context.restore();
	},

	generateClimateInformation : function()
	{
		var type, letters, explanation, output = `<tr><td colspan=3 class="handle" data-target="table.climate"><img src="images/iconmonstr-eye-6.svg" onclick="document.querySelector('table.climate').classList.toggle('open')"> Köppen climate classification</td></tr>`, i;

		for(type in Carte.climateColors)
		{
			letters = type.split("");
			explanation = "";

			for(i = 0; i < letters.length; i++) explanation += Carte.climateInformation[letters[i]] + (i < letters.length - 1 ? ", " : ".");

			output += `<tr id="${ type }"><td>${ type }</td><td style="background-color : ${ Carte.climateColors[type] }"></td><td>${ explanation }</td></tr>`;
		}

		document.querySelector("table.climate").innerHTML = output;
	},

	generateLanguageInformation : function()
	{
		var type, letters, language, iso, explanation, output = `<tr><td colspan=3 class="handle" data-target="table.language"><img src="images/iconmonstr-eye-6.svg" onclick="document.querySelector('table.language').classList.toggle('open')"> Languages</td></tr><tr>`, i;

		var c = 1;

		for(iso in Carte.languagesNames)
		{
			language = Carte.languagesNames[iso];
			output += `<td>${ language.name }</td>${ c % 5 == 0 ? "</tr><tr>" : "" }${ c == Object.keys(Carte.languagesNames).length - 1 ? "</tr>" : "" }`;
			c++;
		}

		document.querySelector("table.language").innerHTML = output;
	},

	resize : function()
	{
		Carte.width = window.innerWidth * window.devicePixelRatio;
		Carte.height = window.innerHeight * window.devicePixelRatio;

		Carte.canvas.width = Carte.width;
		Carte.canvas.height = Carte.height;

		Carte.canvas.style.width = window.innerWidth + "px";
		Carte.canvas.style.height = window.innerHeight + "px";

		Carte.calculate();
	},

	zoom : function(event)
	{
		Carte.scale += event.deltaY / 100;
		Carte.scale = Math.max(1, Carte.scale);
	},

	initialise : function()
	{
		Carte.load(function()
			{
				Carte.calculateStatistics();

				Carte.canvas = document.body.querySelector("canvas");
				Carte.context = Carte.canvas.getContext("2d");

				Carte.resize();

				Carte.draw();

				Carte.updateUserInterface();

				Carte.canvas.addEventListener("mousewheel", function(event)
				{
					Carte.zoom(event);
				})
			});
	},

	updateDetailsMenu : function()
	{
		var details = document.querySelector(".details");

		if(Carte.objectUnderMouse && !Carte.movingElement)
		{
			var object = Carte.objectUnderMouse;

			details.style.display = "block";

			if(object.type == "country")
			{
				var countryLanguages = Carte.languages[object.properties.iso_a2].languages;
				var languagesNames = countryLanguages.map(language => Carte.languagesNames[language].name);

				details.innerHTML =
					`<table><tr><td colspan=2><img class="icon" src="images/flags/${ object.properties.iso_a2.toLowerCase() }.png"> ${ Carte.getCountryNativeName(object) }</td></tr>
					 <tr><td>English</td><td>${ object.properties.name }</td></tr>
					 <tr><td>Formal</td><td>${ object.properties.formal_en }</td></tr>
					 <tr><td>Population</td><td>${ object.properties.pop_est.toFormattedInteger() }</td></tr>
					 <tr><td>Economy</td><td>${ object.properties.economy }</td></tr>
					 <tr><td>Language${ languagesNames.length > 1 ? "s" : "" }</td><td>${ languagesNames.join(", ") }</td></tr></table>`;

				// on effectue les calculs qu'une seule fois

				if(object.climate == null) object.climate = Carte.getCountryClimate(object);
				countryClimates = object.climate;
				document.querySelectorAll("table.climate tr").forEach(function(element){element.classList.remove("selected")});

				for(i = 0; i < countryClimates.length; i++)
				{
					document.querySelector("tr#" + countryClimates[i]).classList.add("selected");
				}
			}

			else if(object.type == "city")
			{
				details.innerHTML =
					`<table><tr><td colspan=2><img class="city icon" src="images/iconmonstr-building-46.svg"> ${ object.properties.name }</td></tr>
					 <tr><td>Region</td><td>${ object.properties.adm1name }</td></tr>
					 <tr><td>Population</td><td>${ object.properties.pop_max.toFormattedInteger() }</td></tr>
					 <tr><td>Coordinates</td><td>${ [object.properties.latitude, object.properties.longitude].toFormattedCoordinates() }</td></tr></table>`;
			}
		}

		else
		{
			details.style.display = "none";
			document.querySelectorAll("table.climate tr").forEach(function(element){element.classList.remove("selected")});
		}
	},

	updateUserInterface : function()
	{
		document.getElementById("fullScreen").checked = Carte.fullScreen;
		document.getElementById("showClimatePoints").checked = Carte.showClimatePoints;
		document.getElementById("dynamicColoring").checked = Carte.dynamicColoring;
		document.getElementById("dynamicColoringRelation").value = Carte.dynamicColoringRelation;
		document.getElementById("showCities").checked = Carte.showCities;
		document.getElementById("showGarland").checked = Carte.showGarland;
		document.getElementById("showBorders").checked = Carte.showBorders;
		document.getElementById("showCirclesOfLatitude").checked = Carte.showCirclesOfLatitude;
	},

	showLoadingMessage : function(message)
	{
		document.querySelector("div.loading > div").innerHTML += "<p>" + message + "</p>";
	},

	download : function()
	{
		var link = document.createElement("a");
		link.download = "map.png";
		link.href = Carte.canvas.toDataURL()
		link.click();
	}
};

// différents écouteurs
window.addEventListener("load", Carte.initialise);
window.addEventListener("resize", function() { Carte.resize() ; Carte.draw() });
window.addEventListener("mousemove", function(event)
	{
		var details = document.querySelector(".details");
		Carte.mousePosition = [event.clientX, event.clientY];

		details.style.left = (Carte.mousePosition[0] + 10) + "px";
		details.style.top = (Carte.mousePosition[1] + 10) + "px";

		if(!Carte.movingElement) Carte.getObjectUnderMouse();
		Carte.draw();

		if(event.target.tagName == "CANVAS") Carte.updateDetailsMenu();
		else document.querySelector("div.details").style.display = "none";

		// pour déplacer les menus
		if(Carte.mouseIsDown && Carte.selectedElement != null)
		{
			if(Carte.selectedElement.classList.contains("handle"))
			{
				Carte.movingElement = true;
				var target = document.querySelector(Carte.selectedElement.getAttribute("data-target"));

				target.style.left = (target.offsetLeft + event.movementX) + "px";
				target.style.top = (target.offsetTop + event.movementY) + "px";
			}

			else Carte.movingElement = false;
		}

		else Carte.movingElement = false;
	} );

window.addEventListener("mousedown", function(event) { Carte.selectedElement = event.target ; Carte.mouseIsDown = true; });
window.addEventListener("mouseup", function() { Carte.selectedElement = null ; Carte.mouseIsDown = false; });
window.addEventListener("mousewheel", function(event)
{
	// super casse-couille à faire, TBD
	Carte.scale += event.deltaY / 100;
});

window.addEventListener("fullscreenchange", function()
{
	if(document.fullscreen || document.webkitIsFullScreen || document.mozFullScreen || document.msFullscreenElement !== null)
	{
		// https://developer.mozilla.org/en-US/docs/Web/API/Element/fullscreenchange_event
		if (!document.fullscreenElement)
			document.getElementById("fullScreen").checked = false;
	}
});
