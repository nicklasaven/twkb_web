
MaxInt8   =-1+(1<<7);
MaxInt16  = -1+(1<<15) ;
MaxInt32  = -1+(1<<31);

min_sizes=[];
min_sizes[1]   = -1 << 7;
min_sizes[2]  = -1<< 15;
min_sizes[4]  = -1<< 31;

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
	ta_struct.coords=[];
	var ndims=ta_struct.ndims;
	var cursor=ta_struct.cursor;
	var little=ta_struct.little;
	var factor=ta_struct.factor;
	var npoints=ta_struct.npoints;
	var coords=[];	
	var last_size=1;
	var start;
	ta_struct.coords[0]=[];
	
	/*If we don't have a reference point yet (This is the first point in the twkb)*/
	if(ta_struct.refpoint[0] ==min_sizes[4])
	{
		for (j =0;j<(ndims);j++)
			{	
				ta_struct.refpoint[j]=readInt32(ta_struct.ta,cursor,little);
				cursor+=4;
				ta_struct.coords[0][j]=ta_struct.refpoint[j]/factor;
			}	
		start=1;
	}
	else	
		start=0;
	
	/*When we iterate the points there  is a rule we have to follow
	if we meet the minimum value the used data-type can hold; then that is a flag that we are changing the data-type.
	The next byte after that tells what the new data-type is. The alternatives is Int8, Int16 and Int32*/
	for (i =start;i<(npoints);i++)
	{
		ta_struct.coords[i]=[];
		for (j =0;j<(ndims);j++)
		{
			do 
			{
				switch(last_size)
				{
					case 1:
						ta_struct.refpoint[4]=((ta_struct.ta[cursor]<<24)>>24);
					break;
					case 2:
						ta_struct.refpoint[4]=(readInt16(ta_struct.ta,cursor,little));
					break;
					case 4:
						ta_struct.refpoint[4]=(readInt32(ta_struct.ta,cursor,little));
					break;
				}	
				cursor+=last_size;
				if(ta_struct.refpoint[4]==min_sizes[last_size])
				{
				
					last_size=(ta_struct.ta[cursor]<<24)>>24;
					cursor++;
				
					ta_struct.refpoint[4]=0;					
				}
				else
				{
					var id=ta_struct.feature.id;	
					ta_struct.refpoint[j]+=ta_struct.refpoint[4];
					ta_struct.coords[i][j]=ta_struct.refpoint[j]/factor;
					ta_struct.refpoint[4]=0;
					break;
				}
				
			} while (1==1)
		}
	}
	ta_struct.cursor=cursor;
	return ta_struct;
}	

function parse_point(ta_struct)
{
	
	ta_struct.feature.geometry.type="Point";			
	
	ta_struct.feature.id=readUInt32(ta_struct.ta,ta_struct.cursor,ta_struct.little);				
	ta_struct.cursor+=4;
	
	ta_struct.npoints=1;
	read_pa(ta_struct);
	ta_struct.feature.geometry.coordinates = [];
	ta_struct.feature.geometry.coordinates = ta_struct.coords;

}
function parse_line(ta_struct)
{	
	ta_struct.feature.geometry.type="LineString";
		
	ta_struct.feature.id=readUInt32(ta_struct.ta,ta_struct.cursor,ta_struct.little);				
	ta_struct.cursor+=4;

	ta_struct.npoints=readUInt32(ta_struct.ta,ta_struct.cursor,ta_struct.little);
	ta_struct.cursor+=4;	
	
	read_pa(ta_struct);	

	ta_struct.feature.geometry.coordinates = ta_struct.coords;
}
function parse_polygon(ta_struct)
{
	ta_struct.feature.geometry={};
	ta_struct.feature.geometry.type="Polygon";
		
	ta_struct.feature.id=readUInt32(ta_struct.ta,ta_struct.cursor,ta_struct.little);				
	ta_struct.cursor+=4;
		
	nrings=readUInt32(ta_struct.ta,ta_struct.cursor,ta_struct.little);
	ta_struct.cursor+=4;
	ta_struct.feature.geometry.coordinates=[];
	for (ring=0;ring<nrings;ring++)
	{		
		ta_struct.feature.geometry.coordinates[ring]=[];
		ta_struct.npoints=readUInt32(ta_struct.ta,ta_struct.cursor,ta_struct.little);
		ta_struct.cursor+=4;	
		read_pa(ta_struct);
		ta_struct.feature.geometry.coordinates[ring] = ta_struct.coords;
	}
	
}
	
function parse_multipoint(ta_struct)
{
	
	ta_struct.feature.geometry.type="MultiPolyline";
	ta_struct.feature.id=readUInt32(ta_struct.ta,ta_struct.cursor,ta_struct.little);				
	ta_struct.cursor+=4;

	ta_struct.npoints=readUInt32(ta_struct.ta,ta_struct.cursor,ta_struct.little);
	ta_struct.cursor+=4;	
		
	read_pa(ta_struct);
	ta_struct.feature.geometry.coordinates = ta_struct.coords;	
}	

	
function parse_multilinestring(ta_struct)
{	
	ta_struct.feature.geometry.type="MultiLineString";
	ta_struct.feature.id=readUInt32(ta_struct.ta,ta_struct.cursor,ta_struct.little);				
	ta_struct.cursor+=4;

	ngeoms=readUInt32(ta_struct.ta,ta_struct.cursor,ta_struct.little);
	ta_struct.cursor+=4;	
	
	ta_struct.feature.geometry.coordinates=[];
	for (geom=0;ring<ngeoms;geom++)
	{		
		ta_struct.feature.geometry.coordinates[geom]=[];
		ta_struct.npoints=readUInt32(ta_struct.ta,ta_struct.cursor,ta_struct.little);
		ta_struct.cursor+=4;	
		read_pa(ta_struct);
		ta_struct.feature.geometry.coordinates[geom] = ta_struct.coords;
	}
}	
	
	
function parse_multipolygon(ta_struct)
{
	
	ta_struct.feature.geometry.type="MultiPolygon";
	ta_struct.feature.id=readUInt32(ta_struct.ta,ta_struct.cursor,ta_struct.little);				
	ta_struct.cursor+=4;

	ngeoms=readUInt32(ta_struct.ta,ta_struct.cursor,ta_struct.little);
	ta_struct.cursor+=4;	
	ta_struct.feature.geometry.coordinates=[];
	for (geom=0;geom<ngeoms;geom++)
	{		
		nrings=readUInt32(ta_struct.ta,ta_struct.cursor,ta_struct.little);
		ta_struct.cursor+=4;
		ta_struct.feature.geometry.coordinates[geom]=[];
		for (ring=0;ring<nrings;ring++)
		{
			ta_struct.feature.geometry.coordinates[geom][ring]=[];
			ta_struct.npoints=readUInt32(ta_struct.ta,ta_struct.cursor,ta_struct.little);
			ta_struct.cursor+=4;	
			read_pa(ta_struct);
			ta_struct.feature.geometry.coordinates[geom][ring] = ta_struct.coords;
		}
	}
}	

function parse_agg_point(geoms,n,ta_struct, the_map,map_name)
{
	var n_geometries=readUInt32( ta_struct.ta,ta_struct.cursor,ta_struct.little);
	ta_struct.cursor+=4;
	for (t=0;t<n_geometries;t++)
	{		
		init_geom_storage(ta_struct, geoms,n);		
		parse_point(ta_struct);	
		cursor=ta_struct.cursor;		
		check_and_build(ta_struct.feature, the_map,map_name);
		n++	
		
	}
}	
function parse_agg_line(geoms,n,ta_struct, the_map,map_name)
{
	var n_geometries=readUInt32(ta_struct.ta,ta_struct.cursor,ta_struct.little);	
	ta_struct.cursor+=4;
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
	var n_geometries=readUInt32(ta_struct.ta,ta_struct.cursor,ta_struct.little);
	ta_struct.cursor+=4;
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
	var geoms = {};
	geoms.type="FeatureCollection";
	geoms.features=[];
	var nrings=1;
	//The length of the whole binary data bulk
	var the_length=ta.byteLength;
	//alert(the_length);
	var ta_struct = {};
	var cursor = 1;
	var n = 0;
	while(cursor<the_length)
	{	
		//The first byte contains information about endianess and the precission of the coordinates
		var flag = ta[cursor];
		cursor ++;
			
		/*If little endianess variable "little" is 1 and 0 if big endianess*/
		var little=flag&0x01;
		
		/*precission gives the factor to divide the coordinate with, giving the right value and number of deciamal digits*/
		var precision=(flag&0xF0)>>4;
		var factor=Math.pow(10,precision);

		/*Here comes a byte containgin type and number of dimmension information*/
		var flag = ta[cursor];
		cursor++;
			
		var typ=flag&0x1F;			
		var ndims=(flag&0xE0)>>5;	
				// we store each geoemtry in a object, "geom"

		
		/*This variable will carry the last refpoint in a pointarray to the next pointarray. It will hold one value per dimmension. For now we just give it the min INT32 number to indicate that we don't have a refpoint yet*/
		//var refpoint = [min_sizes[4]];		
		var buffer = new ArrayBuffer(20);
		var refpoint = new Int32Array(buffer);
		refpoint[0]=min_sizes[4];
		ta_struct={"ta":ta,"ndims":ndims,"cursor":cursor, "little":little, "factor":factor, "refpoint":refpoint};
		
		
		/*If POINT*/			
		if(typ==1)
		{
			init_geom_storage(ta_struct, geoms,n);
			parse_point(ta_struct);
			cursor=ta_struct.cursor;	
			check_and_build(geoms.features[n], the_map,map_name)
			n++			
		}			
		/*if LINESTRING*/
		else if(typ==2)
		{
			init_geom_storage(ta_struct, geoms,n);
			parse_line(ta_struct);
			cursor=ta_struct.cursor;	
			check_and_build(geoms.features[n], the_map,map_name)
			n++
		}		
		/*if POLYGON*/
		else if(typ==3)
		{	
			init_geom_storage(ta_struct, geoms,n);
			parse_polygon(ta_struct);
			cursor=ta_struct.cursor;		
			check_and_build(geoms.features[n], the_map,map_name)
			n++
		}		
		/*if MultiPOINT*/
		else if(typ==4)
		{
			init_geom_storage(ta_struct, geoms,n);
			parse_multipoint(ta_struct);
			cursor=ta_struct.cursor;		
			check_and_build(geoms.features[n], the_map,map_name)
			n++			
		}			
		/*if MultiLINESTRING*/
		else if(typ==5)
		{
			init_geom_storage(ta_struct, geoms,n);
			parse_multiline(ta_struct);
			cursor=ta_struct.cursor;		
			check_and_build(geoms.features[n], the_map,map_name)
			n++
		}		
		/*if MultiPOLYGON*/
		else if(typ==6)
		{	
			init_geom_storage(ta_struct, geoms,n);
			parse_multipolygon(ta_struct);
			cursor=ta_struct.cursor;		
			check_and_build(geoms.features[n], the_map,map_name)
			n++
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

/*Here comes some bit-fiddling functions. They seems faster than the dataview-functions, but it's kind of ugly*/
function readUInt32(source,start,littleEndian) {
  var a0 = source[start+0],
      a1 = source[start+1],
      a2 = source[start+2],
      a3 = source[start+3];
  
  if (littleEndian)
    return ((a3 << 24) >>> 0) + (a2 << 16) + (a1 << 8) + (a0);
  else
    return ((a0 << 24) >>> 0) + (a1 << 16) + (a2 << 8) + (a3);
}
function readUInt16(source,start,littleEndian) {
  var a0 = source[start+0],
      a1 = source[start+1];
  
  if (littleEndian)
    return ((a1 << 8) >>> 0) + (a0);
  else
    return ((a0 << 8) >>> 0) +(a1);
}

 function readInt16(source,start,littleEndian) {
  var a0 = source[start+0],
      a1 = source[start+1];
  
  if (littleEndian)
  {
	if(a1&(1<<7))
	{
	return  -((~(((a1 << 8) >>> 0) + (a0))+1)&(0xFFFF));
	}
	else
		return (a1 << 8)  + (a0);
    }
  else
  {
	if(a0&(1<<7))
	{
	return  -((~(((a0 << 8) >>> 0) + (a1))+1)&(0xFFFF));
	}
	else
		return (a0 << 8)  + (a1);
}
}
       function readInt32(source,start,littleEndian) {
      var a0 = source[start+0],
          a1 = source[start+1],
      a2 = source[start+2],
      a3 = source[start+3];    
      if (littleEndian)
          {
		if(a3&(1<<7))
		{
			return -(~( (a3 << 24) + (a2 << 16) + (a1 << 8) + (a0))+1);
		}
		else
		{		
			return  (a3 << 24) + (a2 << 16) + (a1 << 8) + (a0);
		}
	}
      else
      {
		if(a0&(1<<7))
			return  (~((a0 << 24) + (a1 << 16) + (a2 << 8) + (a3))+1);
		else
			return (a0 << 24) + (a1 << 16) + (a2 << 8) + (a3);
	}
    }