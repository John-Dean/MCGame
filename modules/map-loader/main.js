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
	
	add_resource_pack(){
		return this.model_cache.add_resource_pack(...arguments);
	}
	
	load_world(){
		return this.chunk_data.load_world(...arguments);
	}
	
	async get_chunk_data(x, y){
		let chunk_id = x + "," + y;
		if(this.cached_chunk_data[chunk_id] != undefined){
			return this.cached_chunk_data[chunk_id];
		}
		
		console.time("chunk-file-load")
		let data = await this.chunk_data.get_chunk_data(x, y)
		this.cached_chunk_data[chunk_id] = data;
		console.timeEnd("chunk-file-load")
		
		return data;
	}
	
	async get_chunk_grid(x, y){
		let chunk_id = x + "," + y;
			
		let grid = this.cached_chunk_grid[chunk_id];
		if(grid == undefined){
			let chunk_data = await this.get_chunk_data(x, y)
			
			console.time("creating-grid")		
			grid = await this.chunk_to_models.convert_to_grid(chunk_data)
			
			this.cached_chunk_grid[chunk_id] = grid;
			console.timeEnd("creating-grid")
		}
		
		return grid;
	}
	
	
	async get_chunk_model(x, y){
		let chunk_id = x + "," + y;
		
		let model = this.cached_chunk_models[chunk_id];
		if(model == undefined){
			let grid = await this.get_chunk_grid(x, y);
			model = await this.chunk_to_models.convert_to_model(grid)
			this.cached_chunk_models[chunk_id] = model;
			
			console.timeEnd("chunk-processing")
		}
		
		return model.clone()
	}
	
	async load_chunk(x, y){
		let chunk_models = await this.get_chunk_model(x, y);
		
		console.time("chunk-remeshing")
		let remeshed_chunk_models = this.mesher.remesh(chunk_models)
		console.timeEnd("chunk-remeshing")
		
		return remeshed_chunk_models;
	}
}

export { MapLoader }
