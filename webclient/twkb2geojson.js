/**********************************************************************************************************************
This file describes how twkb can be read into a geoJSON object.

This file can be freely copied, modified and redistributed as you like.
If you develop this further I would appreciate if you shared it, or you will be seen as extremly greedy :-)

Origanally written by
Nickas Av�n
Outer periphery FOSS Technology
**********************************************************************************************************************/
var min_size  = -1<< 63;

function twkb2geojson(ta,the_map, map_name)
{
	geoms = {};
	geoms.type="FeatureCollection";
	geoms.features=[];
	var nrings=1;
		
	//The length of the whole binary data bulk
	var the_length=ta.byteLength;

	var ta_struct = {};
	ta_struct.cursor = 1;
	var n = 0;
	while(ta_struct.cursor<the_length)
	{	
		//The first byte contains information about endianess and the precission of the coordinates
		var flag = ta[ta_struct.cursor];
		ta_struct.cursor ++;
			
		/*1 if ID is used, 0 if not*/
		ta_struct.id=flag&0x01;
		
		/*Method tells what compression method is used*/
		ta_struct.method=(flag&0x0E)>>1;
		/*precission gives the factor to divide the coordinate with, giving the right value and number of deciamal digits*/
		var precision=(flag&0xF0)>>4;
		ta_struct.factor=Math.pow(10,precision);
		/*Here comes a byte containgin type and number of dimmension information*/
		var flag = ta[ta_struct.cursor];
		ta_struct.cursor++;
			
		var typ=flag&0x1F;	
		ta_struct.ndims=(flag&0xE0)>>5;	
				// we store each geoemtry in a object, "geom"

		
		/*This variable will carry the last refpoint in a pointarray to the next pointarray. It will hold one value per dimmension. For now we just give it the min INT32 number to indicate that we don't have a refpoint yet*/		
		var buffer = new ArrayBuffer(20);
		ta_struct.refpoint = new Int32Array(buffer);
		ta_struct.refpoint[0]=min_size;
		ta_struct.ta=ta;
		
		
		/*If POINT*/			
		if(typ==1)
		{
			init_geom_storage(ta_struct, geoms,n);
			parse_point(ta_struct);
			n++			;
		}			
		/*if LINESTRING*/
		else if(typ==2)
		{
			init_geom_storage(ta_struct, geoms,n);
			parse_line(ta_struct);
			n++;
		}		
		/*if POLYGON*/
		else if(typ==3)
		{	
			init_geom_storage(ta_struct, geoms,n);
			parse_polygon(ta_struct);
			n++;
		}		
		/*if MultiPOINT*/
		else if(typ==4)
		{
			init_geom_storage(ta_struct, geoms,n);
			parse_multipoint(ta_struct);
			n++;
		}			
		/*if MultiLINESTRING*/
		else if(typ==5)
		{
			init_geom_storage(ta_struct, geoms,n);
			parse_multiline(ta_struct);
			n++;
		}		
		/*if MultiPOLYGON*/
		else if(typ==6)
		{	
			init_geom_storage(ta_struct, geoms,n);
			parse_multipolygon(ta_struct);
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
	return geoms;
}

function init_geom_storage(ta_struct, geoms,n)
{
	geoms.features[n]={};
	geoms.features[n].type="Feature";		
	geoms.features[n].geometry={};
	ta_struct.feature=geoms.features[n];
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
		n++
	}
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


 function ReadVarSInt64(ta_struct)
{
    nVal = ReadVarInt64(ta_struct);
    /* un-zig-zag-ging */
    if ((nVal & 1) == 0) 
        return ((nVal) >> 1);
    else
        return -(nVal >> 1)-1;
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
		}
	}
	return 0;	
}

