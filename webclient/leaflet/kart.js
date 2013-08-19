

var map=0;
var os = 0;
var topo2 = 0;
var fkb2 = 0;


function init()
{
	
	
//Open Streetmap karta från cloudmade
	var	os =	L.tileLayer('http://{s}.tile.cloudmade.com/BC9A493B41014CAABB98F0471D759707/997/256/{z}/{x}/{y}.png', {
		maxZoom: 18,
		attribution: 'Map data &copy; <a href="http://openstreetmap.org">OpenStreetMap</a> contributors, <a href="http://creativecommons.org/licenses/by-sa/2.0/">CC-BY-SA</a>, Imagery © <a href="http://cloudmade.com">CloudMade</a>'
	});
	

	var topo2_open = L.tileLayer.wms('http://openwms.statkart.no/skwms1/wms.topo2?', {
		layers:	'topo2_wms',
		format: 'image/png',
		epsg: 4326,
		attribution:'<a href="http://www.statkart.no">Kartverket</a>, <a href="http://www.statkart.no/nor/Land/Fagomrader/Geovekst/">Geovekst</a> og <a href="http://www.statkart.no/?module=Articles;action=Article.publicShow;ID=14194">kommuner</a>'
	});	
	

	var topo2 = L.tileLayer.wms('http://wms.geonorge.no/skwms1/wms.topo2?', {
		layers:	'topo2_wms',
		format: 'image/png',
		epsg: 4326,
		attribution:'<a href="http://www.statkart.no">Kartverket</a>, <a href="http://www.statkart.no/nor/Land/Fagomrader/Geovekst/">Geovekst</a> og <a href="http://www.statkart.no/?module=Articles;action=Article.publicShow;ID=14194">kommuner</a>'
	});
	
//Lägg upp listan med bakgrundskartor
	var baseMaps = 
	{

	};	
	
	var overlayMaps =
	{
		"Open StreetMap": os,
		"Statens Kartverk, öppna": topo2_open,
		"Statens Kartverk": topo2
	}

//initiera visning av kartan
	map = L.map('map', {
	center: [63,11],
	zoom: 4,
	layers: [os]
	});

	
	
//lägg till skala och kartväljare
	L.control.scale({position: 'bottomright',imperial:false}).addTo(map);
	L.control.layers(baseMaps, overlayMaps).addTo(map);		

	
}	
	
	
/*Here comes the TWKB-layers*/

//ready-object keeps track of what layers is loaded and what is not
var ready={};

//Create the layer object
var kom1=L.layerGroup();

//initiate that this layer is not loaded yet
 ready["kom1"]=0;

//the function fired when someone clicks "Municipalities"
function kommune()
{
	if(document.getElementById("kom").checked)
	{
		if (!ready["kom1"])//if this layer not is loaded, lets do it
		{
			var map_name="kom"; //the map_name that is used in the web-socket call
			check[map_name]={}; //an object that is used to syncronize when we get the geometry and the attributes back
			get_map(kom1,map_name);	//ok, let's get it
			ready["kom1"]=1; // now the map is loaded. Next time we can just show it directly
		}
		map.addLayer(kom1);
		
	}
	else
	{
		map.removeLayer(kom1);		
	}
}



	var kom=L.layerGroup();
	 ready["kom_org"]=0;
function kom_org()
{
	if(document.getElementById("kom_org").checked)
	{
		if (!ready["kom_org"])
		{
			var map_name="kom_org";
			check[map_name]={};
			get_map(kom,map_name);
			ready["kom_org"]=1;
		}
		map.addLayer(kom);
		
	}
	else
	{
		map.removeLayer(kom);		
	}
}
	var arealdekke=L.layerGroup();
	 ready["arealdekke"]=0;
function ad()
{
	if(document.getElementById("ad").checked)
	{
		if (!ready["arealdekke"])
		{
			var map_name="ad";
			check[map_name]={};
			get_map(arealdekke,map_name);
			ready["arealdekke"]=1;
		}
		map.addLayer(arealdekke);
		
	}
	else
	{
		map.removeLayer(arealdekke);		
	}
}



	var samf=L.layerGroup();
	 ready["samf"]=0;
function sf()
{
	if(document.getElementById("sf").checked)
	{
		if (!ready["samf"])
		{
			var map_name="samf";
			check[map_name]={};
			get_map(samf,map_name);
			ready["samf"]=1;
		}
		map.addLayer(samf);
		
	}
	else
	{
		map.removeLayer(samf);		
	}
}
	var hojd=L.layerGroup();
	 ready["hojd"]=0;
function hjd()
{
	if(document.getElementById("hjd").checked)
	{
		if (!ready["hojd"])
		{
			var map_name="hojd";
			check[map_name]={};
			get_map(hojd,map_name);
			ready["hojd"]=1;
		}
		map.addLayer(hojd);
		
	}
	else
	{
		map.removeLayer(hojd);		
	}
}

