/**********************************************************************************************************************
This file describes how twkb can be read into a geoJSON object.

This file can be freely copied, modified and redistributed as you like.
If you find better ways of doing this it would be nice if you published it, or you will be seen as extremly greedy :-)

Origanally written by
Nickas Avén
Outer periphery FOSS Technology
**********************************************************************************************************************/


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
			
		/*If little endianess variable "little" is 1 and 0 if big endianess*/
		ta_struct.little=flag&0x01;
		
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
		//var refpoint = [min_sizes[4]];		
		var buffer = new ArrayBuffer(20);
		ta_struct.refpoint = new Int32Array(buffer);
		ta_struct.refpoint[0]=min_sizes[4];
		ta_struct.ta=ta;
	//	ta_struct={"method":method,"ta":ta,"ndims":ndims,"cursor":cursor, "little":little, "factor":factor, "refpoint":refpoint};
		
		
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
	ta_struct.feature.id=ReadVarInt64(ta_struct);
	ta_struct.npoints=1;
	read_pa(ta_struct);
	ta_struct.feature.geometry.coordinates = [];
	ta_struct.feature.geometry.coordinates = ta_struct.coords;

}
function parse_line(ta_struct)
{	
	ta_struct.feature.geometry.type="LineString";		
	ta_struct.feature.id=ReadVarInt64(ta_struct);	
	ta_struct.npoints=ReadVarInt64(ta_struct);
	read_pa(ta_struct);	

	ta_struct.feature.geometry.coordinates = ta_struct.coords;
}
function parse_polygon(ta_struct)
{
	ta_struct.feature.geometry={};
	ta_struct.feature.geometry.type="Polygon";
		
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
	ta_struct.feature.id=ReadVarInt64(ta_struct);		

	ta_struct.npoints=ReadVarInt64(ta_struct);
		
	read_pa(ta_struct);
	ta_struct.feature.geometry.coordinates = ta_struct.coords;	
}	

	
function parse_multilinestring(ta_struct)
{	
	ta_struct.feature.geometry.type="MultiLineString";
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
		case 0:
			read_pa_m0(ta_struct);
		break;
		case 1:
			read_pa_m1(ta_struct);
		break;
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
	if(ta_struct.refpoint[0] ==min_sizes[4])
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


/*****************************************************************************************************************************************************''
Here starts functions for what is now called "method0". Tha varInt method called "method1" so what is below here will probably disapear.
But it will stay for a little while for some more evaluation.
*******************************************************************************************************************************************************/
MaxInt8   =-1+(1<<7);
MaxInt16  = -1+(1<<15) ;
MaxInt32  = -1+(1<<31);

min_sizes=[];
min_sizes[1]   = -1 << 7;
min_sizes[2]  = -1<< 15;
min_sizes[4]  = -1<< 31;

function read_pa_m0(ta_struct)
{
	ta_struct.coords=[];
	var ndims=ta_struct.ndims;
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
				ta_struct.refpoint[j]=ReadVarSInt64(ta_struct);
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
						ta_struct.refpoint[4]=((ta_struct.ta[ta_struct.cursor]<<24)>>24);
					break;
					case 2:
						ta_struct.refpoint[4]=(readInt16(ta_struct.ta,ta_struct.cursor,little));
					break;
					case 4:
						ta_struct.refpoint[4]=(readInt32(ta_struct.ta,ta_struct.cursor,little));
					break;
				}	
				ta_struct.cursor+=last_size;
				if(ta_struct.refpoint[4]==min_sizes[last_size])
				{
				
					last_size=(ta_struct.ta[ta_struct.cursor]<<24)>>24;
					ta_struct.cursor++;
				
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
	return 0;
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
