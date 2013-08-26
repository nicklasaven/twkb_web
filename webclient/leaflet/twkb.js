
var min_size  = -1<< 63;

var d = new Date();
var  tid=[];
var geometries={};
var	check={};
var ws_calls=[];	
	
	
var ws = new WebSocket('ws://178.79.156.122:8088');
//var ws = new WebSocket('ws://localhost:8088');
	
ws.binaryType = 'arraybuffer';
	
function get_capabilities()
{
	ws.send(JSON.stringify({"request":"getcapabilities"}));
	ws.onmessage = function (event) {
	if(!(event.data instanceof ArrayBuffer))
	{
		d=JSON.parse(event.data);
		if(d[0]=="capabilities")
		{
			alert(JSON.stringify(d[1]));
		}

	}
	};
}
function get_map(the_map,map_name) 
{

	var c=map.getCenter(); //get the center of the map so we can get the geometries ordered from this center
	var p = {"x":c.lng, "y":c.lat};

	/*we count our calls to the websocket and use the number as id on the call.
	 If not, the styling might get mixed if one layer is not finnished when next is clicked*/
	nr=ws_calls.length; 
	ws_calls[nr]=[the_map,map_name];

	/*Here we send our request to the websocket. Here you can also specify srid and number of decimals in the returned geoemtries*/
    	ws.send(JSON.stringify({"nr":nr,"map_name":map_name,"center":p,"inverted_lat_lng":"true", "agg":"true"}));

	ws.onmessage = function (event) {
	if(event.data instanceof ArrayBuffer) //ArrayBuffer? ok, then it is our geometry comming
	{
		var ta = new Uint8Array(event.data);		
		
		parse_binary(ta,ws_calls[ta[0]][0],ws_calls[ta[0]][1]); //send the binary array for parsing with the mapname, and the map to add the data to as parameters
	}
	else //ok, this is the attribute answer
	{
		d=JSON.parse(event.data);
		if(!(d[0]=="capabilities"))
		{
			m=ws_calls[d[0]];
		
			//check if the geoemtry is ready parsed, then go build some leaflet-geometry, otherwise just hold the attributes and wait
			if(check[m[1]][d[1]] && check[m][d[1]].geom)
			{
				check[m[1]][d[1]].attr = d;
				build(d[1],m[0],m[1]);
			}
			else
			{
				check[m[1]][d[1]]={};
				check[m[1]][d[1]].attr = d;		
			}
		}
	}	
      };      
}
	

/*A function to read the point array*/
function read_pa(ta_struct)
{
		switch(ta_struct.method)
		{
			case 1:
				read_pa_m1(ta_struct);
			break;
		}	
	}


function ReadVarInt64(ta_struct)
{
    cursor=ta_struct.cursor;
	nVal = 0;
    nShift = 0;

    while(1)
    {
        nByte = ta_struct.ta[cursor];
        if (!(nByte & 0x80))
        {
            cursor++;
	ta_struct.cursor=cursor;
            return nVal | (nByte << nShift);
        }
        nVal = nVal | (nByte & 0x7f) << nShift;
        cursor ++;
        nShift += 7;
    }
}
 function ReadVarSInt64(ta_struct)
{
    nVal = ReadVarInt64(ta_struct);
//	console.log('utan zig-zag%d',nVal);
    /* un-zig-zag-ging */
    if ((nVal & 1) == 0) 
        return ((nVal) >> 1);
    else
        return -(nVal >> 1)-1;
}

function read_pa_m1(ta_struct)
{
	ta_struct.coords=[];
	var ndims=ta_struct.ndims;
	var factor=ta_struct.factor;
	var npoints=ta_struct.npoints;
	var coords=[];
	ta_struct.coords[0]=[];
	
	start=0;	
	/*If we don't have a reference point yet (This is the first point in the twkb)*/
	if(ta_struct.refpoint[0] ==min_size)
	{
		for (j =0;j<(ndims);j++)
			{	
				ta_struct.refpoint[j]=ReadVarSInt64(ta_struct);
				ta_struct.coords[0][j]=ta_struct.refpoint[j]/factor;
	//				console.log(' j=%d, val=%s, ta_struct.cursor=%d',j,ta_struct.coords[0][j],ta_struct.cursor);
			}	
		start=1;
	}	

	for (i =start;i<(npoints);i++)
	{
		ta_struct.coords[i]=[];
		for (j =0;j<(ndims);j++)
		{
			ta_struct.refpoint[j]+=ReadVarSInt64(ta_struct);
			ta_struct.coords[i][j]=ta_struct.refpoint[j]/factor;		
	//console.log('i=%d, j=%d, val=%s, ta_struct.cursor=%d',i,j,ta_struct.coords[0][j],ta_struct.cursor);			
		}
	}
	return 0;	
}

function parse_point(ta_struct)
{
	
	ta_struct.feature.geometry.type="Point";			
	if(ta_struct.id)
		ta_struct.feature.id=ReadVarInt64(ta_struct);
	ta_struct.npoints=1;
	read_pa(ta_struct);
	ta_struct.feature.geometry.coordinates = [];
	ta_struct.feature.geometry.coordinates = ta_struct.coords;

}
function parse_line(ta_struct)
{	
	ta_struct.feature.geometry.type="LineString";		
	if(ta_struct.id)
		ta_struct.feature.id=ReadVarInt64(ta_struct);
	ta_struct.npoints=ReadVarInt64(ta_struct);
	read_pa(ta_struct);	

	ta_struct.feature.geometry.coordinates = ta_struct.coords;
}
function parse_polygon(ta_struct)
{
	ta_struct.feature.geometry={};
	ta_struct.feature.geometry.type="Polygon";		
	if(ta_struct.id)
		ta_struct.feature.id=ReadVarInt64(ta_struct);		
	nrings=ReadVarInt64(ta_struct);
	ta_struct.feature.geometry.coordinates=[];
	for (ring=0;ring<nrings;ring++)
	{		
		ta_struct.feature.geometry.coordinates[ring]=[];
		ta_struct.npoints=ReadVarInt64(ta_struct);
		read_pa(ta_struct);
		ta_struct.feature.geometry.coordinates[ring] = ta_struct.coords;
	}
	
}
	
function parse_multipoint(ta_struct)
{
	
	ta_struct.feature.geometry.type="MultiPolyline";
	if(ta_struct.id)
		ta_struct.feature.id=ReadVarInt64(ta_struct);
	ta_struct.npoints=ReadVarInt64(ta_struct);
		
	read_pa(ta_struct);
	ta_struct.feature.geometry.coordinates = ta_struct.coords;	
}	

	
function parse_multilinestring(ta_struct)
{	
	ta_struct.feature.geometry.type="MultiLineString";
	if(ta_struct.id)
		ta_struct.feature.id=ReadVarInt64(ta_struct);	
	ngeoms=ReadVarInt64(ta_struct);
	
	
	ta_struct.feature.geometry.coordinates=[];
	for (geom=0;ring<ngeoms;geom++)
	{		
		ta_struct.feature.geometry.coordinates[geom]=[];
		ta_struct.npoints=ReadVarInt64(ta_struct);
		read_pa(ta_struct);
		ta_struct.feature.geometry.coordinates[geom] = ta_struct.coords;
	}
}	
	
	
function parse_multipolygon(ta_struct)
{
	
	ta_struct.feature.geometry.type="MultiPolygon";
	if(ta_struct.id)
		ta_struct.feature.id=ReadVarInt64(ta_struct);				

	ngeoms=ReadVarInt64(ta_struct);
	
	ta_struct.feature.geometry.coordinates=[];
	for (geom=0;geom<ngeoms;geom++)
	{		
		nrings=ReadVarInt64(ta_struct);
		
		ta_struct.feature.geometry.coordinates[geom]=[];
		for (ring=0;ring<nrings;ring++)
		{
			ta_struct.feature.geometry.coordinates[geom][ring]=[];
			ta_struct.npoints=ReadVarInt64(ta_struct);
			read_pa(ta_struct);
			ta_struct.feature.geometry.coordinates[geom][ring] = ta_struct.coords;
		}
	}
}	

function parse_agg_point(geoms,n,ta_struct, the_map,map_name)
{
	var n_geometries=ReadVarInt64(ta_struct);
	for (t=0;t<n_geometries;t++)
	{		
		init_geom_storage(ta_struct, geoms,n);		
		parse_point(ta_struct);		
		check_and_build(ta_struct.feature, the_map,map_name);
		n++	
		
	}
}	
function parse_agg_line(geoms,n,ta_struct, the_map,map_name)
{
	var n_geometries=ReadVarInt64(ta_struct);	
	for (t=0;t<n_geometries;t++)
	{
		init_geom_storage(ta_struct, geoms,n);	
		parse_line(ta_struct);
		check_and_build(ta_struct.feature, the_map,map_name)
		n++	
	}
}	
function parse_agg_polygon(geoms,n,ta_struct, the_map,map_name)
{
	var n_geometries=ReadVarInt64(ta_struct);
	for (t=0;t<n_geometries;t++)
	{
		init_geom_storage(ta_struct, geoms,n);	
		parse_polygon(ta_struct);
		check_and_build(ta_struct.feature, the_map,map_name)
		n++
	}
}	


function parse_binary(ta,the_map, map_name)
{
	geoms = {};
	geoms.type="FeatureCollection";
	geoms.features=[];
	var nrings=1;
	//The length of the whole binary data bulk
	var the_length=ta.byteLength;
	//alert(the_length);
	var ta_struct = {};
	ta_struct.cursor = 1;
	var n = 0;
	while(ta_struct.cursor<the_length)
	{	
		//The first byte contains information about endianess and the precission of the coordinates
		var flag = ta[ta_struct.cursor];
		ta_struct.cursor ++;
			
		/*1 if ID is used, = if not*/
		ta_struct.id=flag&0x01;
		
		/*Method tells what compression method is used*/
		ta_struct.method=(flag&0x0E)>>1;
//		alert("method="+ta_struct.method);
		/*precission gives the factor to divide the coordinate with, giving the right value and number of deciamal digits*/
		var precision=(flag&0xF0)>>4;
		ta_struct.factor=Math.pow(10,precision);
//		alert("factor="+ta_struct.factor);		
		/*Here comes a byte containgin type and number of dimmension information*/
		var flag = ta[ta_struct.cursor];
		ta_struct.cursor++;
			
		var typ=flag&0x1F;	
//		alert("typ="+typ);	
		ta_struct.ndims=(flag&0xE0)>>5;	
				// we store each geoemtry in a object, "geom"

		
		/*This variable will carry the last refpoint in a pointarray to the next pointarray. It will hold one value per dimmension. For now we just give it the min INT32 number to indicate that we don't have a refpoint yet*/
		//var refpoint = [min_size];		
		var buffer = new ArrayBuffer(20);
		ta_struct.refpoint = new Int32Array(buffer);
		ta_struct.refpoint[0]=min_size;
		ta_struct.ta=ta;
	//	ta_struct={"method":method,"ta":ta,"ndims":ndims,"cursor":cursor, "little":little, "factor":factor, "refpoint":refpoint};
		
		
		/*If POINT*/			
		if(typ==1)
		{
			init_geom_storage(ta_struct, geoms,n);
			parse_point(ta_struct);
			check_and_build(geoms.features[n], the_map,map_name);
			n++			;
		}			
		/*if LINESTRING*/
		else if(typ==2)
		{
			init_geom_storage(ta_struct, geoms,n);
			parse_line(ta_struct);
			check_and_build(geoms.features[n], the_map,map_name);
			n++;
		}		
		/*if POLYGON*/
		else if(typ==3)
		{	
			init_geom_storage(ta_struct, geoms,n);
			parse_polygon(ta_struct);
			check_and_build(geoms.features[n], the_map,map_name);
			n++;
		}		
		/*if MultiPOINT*/
		else if(typ==4)
		{
			init_geom_storage(ta_struct, geoms,n);
			parse_multipoint(ta_struct);
			check_and_build(geoms.features[n], the_map,map_name);
			n++;
		}			
		/*if MultiLINESTRING*/
		else if(typ==5)
		{
			init_geom_storage(ta_struct, geoms,n);
			parse_multiline(ta_struct);
			check_and_build(geoms.features[n], the_map,map_name);
			n++;
		}		
		/*if MultiPOLYGON*/
		else if(typ==6)
		{	
			init_geom_storage(ta_struct, geoms,n);
			parse_multipolygon(ta_struct);
			check_and_build(geoms.features[n], the_map,map_name);
			n++;
		}
		/*if aggregated POINT*/
		else if(typ==21)
		{
			parse_agg_point(geoms,n,ta_struct, the_map,map_name);
			cursor=ta_struct.cursor;				
		}	
		
		/*if aggregated LINESTRING*/
		else if(typ==22)
		{
			parse_agg_line(geoms,n,ta_struct, the_map,map_name);
			cursor=ta_struct.cursor;	
		}		
		/*if aggregated POLYGON*/
		else if(typ==23)
		{	
			parse_agg_polygon(geoms,n,ta_struct, the_map,map_name);
			cursor=ta_struct.cursor;	
		}
	}		
}
function init_geom_storage(ta_struct, geoms,n)
{
		geoms.features[n]={};
		geoms.features[n].type="Feature";		
		geoms.features[n].geometry={};
		ta_struct.feature=geoms.features[n];
}
function check_and_build(feature, the_map,map_name)
{
		if(check[map_name][feature.id] && check[map_name][feature.id].attr)
		{
			check[map_name][feature.id].geom = feature.geometry;
			build(feature.id,the_map, map_name);
		}
		else
		{
			check[map_name][feature.id]={};
			check[map_name][feature.id].geom = feature.geometry;					
		}
}
//Here is style-arrays for the styling. Those should of course be sent from the server instead, but this is just an example
var areal_colors=["#ff9","#00f","#0f0","#ff3","#00f","#555","#fff","#55f"];
var veg_colors=[["#900","1.5"],["#999","0.5"],["#999","1"],["#999","1"],["#900","2"],["#000","1,5"],["#009","0.5"]];

//A function to build the leaflet geoemtries
function build(id,the_map,map_name)
{
	all=check[map_name][id];
	geom=all.geom;
	attr=all.attr;
	
	//also this should be handled by some json-object defined from getcapabilities-response from the server
	if(map_name=="kom_org")
	{//alert("build:"+geom.geometry.coordinates);
		L.multiPolygon(geom.coordinates, {smoothFactor:1,weight:1,color: 'green',fillOpacity:0.01}).addTo(the_map);
	}
	else if(map_name=="kom")
		L.polygon(geom.coordinates, {smoothFactor:1,weight:1,color: 'red',fillOpacity:0.01}).addTo(the_map);
	else if(map_name=="ad")
	{
		L.polygon(geom.coordinates, {smoothFactor:1,weight:1,color: areal_colors[attr[2]-1],fillOpacity:0.3}).addTo(the_map);			
	}
	else if(map_name=="hojd")
	{
		L.polyline(geom.coordinates, {smoothFactor:1,weight:0.8,color: '£999'}).addTo(the_map);			
	}
	else if(map_name=="samf")
	{
		s=veg_colors[attr[2]-1];
		L.polyline(geom.coordinates, {smoothFactor:1,weight:s[1],color: s[0],opacity:1}).addTo(the_map);			
	}	
	else if(map_name=="punkter")
	{
	//	alert("build="+geom.coordinates[0]);
		L.circle(geom.coordinates[0],1).addTo(the_map);			
	}	
	
	delete check[map_name][id];
}
