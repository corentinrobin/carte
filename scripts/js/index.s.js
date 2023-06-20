/* Auteur : Corentin ROBIN */

// Données : http://geojson.xyz/

Number.prototype.toRadians = function()
{
	return this * Math.PI / 180;
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
	width : 0,
	height : 0,
	canvas : null,

	countries : null,
	cities : null,

	renderingTime : 0,

	load : function(callback)
	{
		var request = new XMLHttpRequest();

		request.onload = function()
		{
			Carte.countries = JSON.parse(this.responseText).features;

			var secondRequest = new XMLHttpRequest();

			secondRequest.onload = function()
			{
				Carte.cities = JSON.parse(this.responseText).features;

				callback();
			}

			// ensuite on charge les villes
			secondRequest.open("GET", "/data/ne_50m_populated_places_simple.geojson");
			secondRequest.send();
		}

		// on charge d'abord la géométrie des pays
		request.open("GET", "/data/ne_110m_admin_0_countries.geojson");
		request.send();
	},

	drawCountry : function(points)
	{
		var i, context = Carte.context;

		context.beginPath();

		var firstPoint = points[0].toMercator();

		context.moveTo(firstPoint[0], firstPoint[1]);

		for(i = 1; i < points.length; i++)
		{
			point = points[i].toMercator();
			context.lineTo(point[0], point[1]);
		}

		context.closePath();
		context.stroke();
	},

	draw : function()
	{
		var t0 = performance.now();

		var i, j, k, polygons, points, point;

		var context = Carte.context;

		context.fillStyle = "black";
		context.strokeStyle = "white";

		context.clearRect(0, 0, Carte.width, Carte.height);
		context.fillRect(0, 0, Carte.width, Carte.height);

		for(i = 0; i < Carte.countries.length; i++)
		{
			type = Carte.countries[i].geometry.type;

			if(type == "Polygon")
			{
				points = Carte.countries[i].geometry.coordinates[0];

				Carte.drawCountry(points);
			}

			else if(type == "MultiPolygon")
			{
				polygons = Carte.countries[i].geometry.coordinates;

				for(j = 0; j < polygons.length; j++)
				{
					points = polygons[j][0];

					Carte.drawCountry(points);
				}
			}
		}

		for(i = 0; i < Carte.cities.length; i++)
		{
			city = Carte.cities[i];

			position = city.geometry.coordinates.toMercator();

			context.beginPath();
			context.arc(position[0], position[1], 1, 0, 2 * Math.PI);
			context.stroke();
			context.closePath();
		}

		Carte.renderingTime = performance.now() - t0;
	},

	refresh : function()
	{

	},

	resize : function()
	{
		Carte.width = window.innerWidth * window.devicePixelRatio;
		Carte.height = window.innerHeight * window.devicePixelRatio;

		Carte.canvas.width = Carte.width;
		Carte.canvas.height = Carte.height;

		Carte.canvas.style.width = window.innerWidth + "px";
		Carte.canvas.style.height = window.innerHeight + "px";
	},

	initialise : function()
	{
		Carte.load(function()
			{
				Carte.canvas = document.body.querySelector("canvas");
				Carte.context = Carte.canvas.getContext("2d");

				Carte.resize();

				Carte.draw();
			});
	}
};

window.addEventListener("load", Carte.initialise);
window.addEventListener("resize", function() { Carte.resize() ; Carte.draw() });