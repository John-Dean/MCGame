import { ModelCache } from "../model-cache/main.js"
import { ChunkData } from "../chunk-data/main.js";
import { ChunkToModels } from "../chunk-to-models/main.js";
import { GreedyMesher } from "../greedy-mesher/main.js";


class MapLoader {
	constructor(model_cache = new ModelCache(), chunk_data = new ChunkData(), mesher = new GreedyMesher()){
		this.model_cache = model_cache;
		this.chunk_data = chunk_data;
		this.mesher = mesher;
		
		this.cached_chunk_data = {};
		this.cached_chunk_models = {};
		
		this.cached_chunk_grid = {};
		
		this.chunk_to_models = new ChunkToModels(model_cache);
	}
	
	async get_world_data(){
		return await this.chunk_data.world.get_level_data();
	}
	
	add_resource_pack(){
		return this.model_cache.add_resource_pack(...arguments);
	}
	
	load_world(){
		return this.chunk_data.load_world(...arguments);
	}
	
	async get_chunk_data(x, z){
		let chunk_id = x + "," + z;
		if(this.cached_chunk_data[chunk_id] != undefined){
			return this.cached_chunk_data[chunk_id];
		}
		
		console.time("chunk-file-load|"+x+","+z)
		let data = await this.chunk_data.get_chunk_data(x, z);
		this.cached_chunk_data[chunk_id] = data;
		console.timeEnd("chunk-file-load|"+x+","+z)
		
		return data;
	}
	
	async get_chunk_grid(x, z){
		let chunk_id = x + "," + z;
			
		let grid = this.cached_chunk_grid[chunk_id];
		if(grid == undefined){
			let chunk_data = await this.get_chunk_data(x, z)
			
			console.time("creating-grid|"+x+","+z)
			grid = await this.chunk_to_models.convert_to_grid(chunk_data)
			
			this.cached_chunk_grid[chunk_id] = grid;
			console.timeEnd("creating-grid|"+x+","+z)
		}
		
		return grid;
	}
	
	async get_chunk_model(x, z){
		let chunk_id = x + "," + z;
		
		let model = this.cached_chunk_models[chunk_id];
		if(model == undefined){
			console.time("chunk-obtaining")
			let grid_promise = this.get_chunk_grid(x, z);
			let x_low_promise = this.get_chunk_grid(x - 1, z);
			let x_high_promise = this.get_chunk_grid(x + 1, z);
			let z_low_promise = this.get_chunk_grid(x, z - 1);
			let z_high_promise = this.get_chunk_grid(x, z + 1);
			
			let grid_promises = await Promise.all([grid_promise, x_low_promise, x_high_promise, z_low_promise, z_high_promise]);
			
			let grid = grid_promises[0];
			grid.x_low = grid_promises[1] 
			grid.x_high = grid_promises[2] 
			grid.z_low = grid_promises[3] 
			grid.z_high = grid_promises[4]
			
			console.timeEnd("chunk-obtaining")
			
			console.time("chunk-to-model")
			model = await this.chunk_to_models.convert_to_model(grid)
			console.timeEnd("chunk-to-model")
			this.cached_chunk_models[chunk_id] = model;
			
			model.position.x = x * 16;
			model.position.z = z * 16;
		}
		
		return model.clone()
	}
	
	async load_chunk(x, z){
		console.time("chunk-end-to-end")
		let chunk_models = await this.get_chunk_model(x, z);
		
		
		console.time("chunk-remeshing")
		let remeshed_chunk_models = this.mesher.remesh(chunk_models)
		console.timeEnd("chunk-remeshing")
		
		console.timeEnd("chunk-end-to-end")
		return remeshed_chunk_models;
	}
	
	
	async get_model(model_name){
		let model = await this.model_cache.get_model(model_name)
		
		return model;
	}
	
	async get_block_from_blockstate(blockstate_name, options){
		let variants = await this.model_cache.get_blockstates(blockstate_name);
		let variant = await this.model_cache.pick_variant(variants, options);
		let model = await this.get_model(variant);
		
		return model.clone();
	}
}

export { MapLoader }
