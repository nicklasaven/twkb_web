/*This is a nodejs webserver, serving a websocket with TWKB-geometries

This is just for showing some ideas how it can be done*/


/*This first part describes the layers available. It should of course be moved out to a config file or to the database.*/
my_maps={
	"kom_org":{
		"geometry_column":"geom",
		"default_precision":"5",
		"id_column":"kommunenr",
		"default_srid":"4326",		
		"attributes":["kommunenr"],
		"sql_from":"kom_geom",
		"description":"Municipalities with more details"
		}
	,
	"kom":{
		"geometry_column":"geom",
		"default_precision":"5",
		"id_column":"kom_nr",
		"default_srid":"4326",		
		"attributes":["kom_nr", "kom_txt"],
		"sql_from":"prep.n2000_kommuner",
		"description":"Municipalities from n2000 map of Norway"
		}
	,
	"ad":{
		"geometry_column":"geom",
		"default_precision":"5",
		"id_column":"objectid",
		"default_srid":"4326",		
		"attributes":["objectid","typnr"],
		"sql_from":"prep.n2000_arealtyper",
		"description":"This is a map of Norway showing the Areal types"
		}
	,
	"hojd":{
		"geometry_column":"geom",
		"default_precision":"5",
		"id_column":"objectid",
		"default_srid":"4326",		
		"attributes":["objectid","hoyde"],
		"sql_from":"prep.n2000_hojd",
		"description":"n2000 height information"
		}
	,
	"samf":{
		"geometry_column":"geom",
		"default_precision":"5",
		"id_column":"objectid",
		"default_srid":"4326",		
		"attributes":["objectid","typnr"],
		"sql_from":"prep.n2000_samferdsel",
		"description":"This is a map of Norway showing the Areal types"
		}
	};

var keys = [];
	for(var name in my_maps) 
	keys.push(name);


var WebSocketServer = require('ws').Server
  , express = require('express')
  , app = express()
  ,pg = require('pg').native
  ,http = require('http')
  ,cluster=require('cluster');

var client = new pg.Client({
    user: 'user',
    password: 'password',
    database: 'db',
    host: 'localhost',
    port: 5432
  });
  
 if (cluster.isMaster) 
  { 
	   // Count the machine's CPUs
    var cpuCount = require('os').cpus().length;

    // Create a worker for each CPU
	for (var i = 0; i < cpuCount; i += 1) 
	{
		cluster.fork();
	} 
	// Listen for dying workers
	cluster.on('exit', function (worker) {
		// Replace the dead worker,
		// we're not sentimental
		console.log('Worker ' + worker.id + ' died :(');
		cluster.fork();
	}); 
}
else 
{

	client.connect();

	var server = http.createServer(app);
	server.listen(8088);

	var wss = new WebSocketServer({server: server});

	wss.on('connection', function(ws) 
	{
		ws.on('message', function(message)
		{
		console.log('received: %s', message);	
		var the_call=JSON.parse(message);
		if(the_call.request && the_call.request=="getcapabilities")
		{
			ws.send(JSON.stringify(["capabilities",my_maps]));				
		}	
		else
		{
			parameters=[];
			n_parameters=0;
			my_map=my_maps[the_call.map_name];


			sql_txt="SELECT "+my_map.attributes;

			parameters[n_parameters++]=the_call.nr;
			sql_txt=sql_txt+",set_byte(substring('0'::bytea ,1,1),0,$"+n_parameters+")||";

			geometry_column=my_map.geometry_column;

			if(the_call.srid)
			{	
				srid=the_call.srid;
				parameters[n_parameters++]=srid;
				geometry_column = "ST_Transform("+geometry_column+",$"+n_parameters+")"; 
			}
			else
				srid=my_map.default_srid;

			if(the_call.inverted_lat_lng)
				geometry_column="ST_Affine("+geometry_column+",0,1,1,0,0,0)";

			if(the_call.precision)
			{
				parameters[n_parameters++]=the_call.precision;
			}		
			else
			{
				parameters[n_parameters++]=my_map.default_precision;
			}
			
			sql_txt=sql_txt+"ST_AsTWKB("+geometry_column+",$"+n_parameters+","+my_map.id_column+",'NDR') geom FROM "+my_map.sql_from;			
			
			if(the_call.center && the_call.center.x && the_call.center.y)
				{	
					
					parameters[n_parameters++]=the_call.center.x;
					the_point=" ST_SetSRID(ST_Point($"+n_parameters;
					parameters[n_parameters++]=the_call.center.y;
					the_point=the_point+",$"+n_parameters+")";
					parameters[n_parameters++]=srid;
					the_point=the_point+",$"+n_parameters+")";
					
					sql_txt=sql_txt+" ORDER BY "+ the_point + "<#>"+my_map.geometry_column;
				}

			var query = client.query(sql_txt,parameters);
			var attr=[the_call.nr];

			query.on('row', function(row)
			{
				for (t=0;t<my_map.attributes.length;t++)				{
					
					attr[t+1]=row[my_map.attributes[t]];				
				}
				ws.send(JSON.stringify(attr),{binary: false});
				ws.send(row.geom,{binary: true});
			});	

		}
		});
	});
}
