import { VariantSelector } from "../blockstate-variant-selector/main.js";
import { BlockLoader } from "../block-loader/main.js";
import { ModelCleaner } from "../model-cleaner/main.js";

const add_cache_hit_flag = function(object){
	Object.defineProperty(object, 'cache_hit', {
		value: true,
		writable: false,
		enumerable: false
	});
	
	return object;
}

class ModelCache {
	constructor(model_cache = {}, blockstate_cache = {}){
		this.model_cache =	model_cache;
		this.blockstate_cache =	blockstate_cache;
		this.block_loader = new BlockLoader();
		this.model_cleaner = new ModelCleaner();
		
		this.variant_selector = VariantSelector;
	}
	
	add_resource_pack(){
		return this.block_loader.add_resource_pack(...arguments)
	}
	
	pick_variant(){
		return this.variant_selector.pick_blockstate(...arguments)
	}
	
	get_model(model_name, options){
		if(typeof model_name === "object"){
			if(model_name instanceof Array){
				return this.get_models(...arguments)
			}
			options = model_name;
			model_name = options.model;
		}
		
		const cache = this.model_cache;
		
		const uv_lock = options.uvlock || false;
		const x = options.x || 0;
		const y = options.y || 0;
		
		if(cache[model_name] == undefined){
			cache[model_name] = {};
		}
		if(cache[model_name][uv_lock] == undefined){
			cache[model_name][uv_lock] = {};
		}
		if(cache[model_name][uv_lock][x] == undefined){
			cache[model_name][uv_lock][x] = {};
		}
		if(cache[model_name][uv_lock][x][y] == undefined){
			cache[model_name][uv_lock][x][y] = this.get_model_no_cache(model_name, options)
			.then(
				function(data){
					cache[model_name][uv_lock][x][y] = add_cache_hit_flag(data);
					return data;
				}
			)
		}
		
		return cache[model_name][uv_lock][x][y]
	}
	
	async get_model_no_cache(model_name, options){
		const block_loader = this.block_loader;
		const model_cleaner = this.model_cleaner;
		
		let model_data = await block_loader.get_model_data(model_name);
		
		let model = await block_loader.get_model(model_data, options);
		
		let clean_model = await model_cleaner.clean_model(model)
		
		return clean_model;
	}
	
	process_models(model_list, merge = true){
		if(merge){
			const merged_model = this.model_cleaner.merge_models(model_list);
			return add_cache_hit_flag(merged_model);
		}
		return add_cache_hit_flag(model_list);
	}
	
	get_models(model_name_list, merge = true){
		const model_list = model_name_list.map(model => this.get_model(model));
		
		// Work out if we hit the cache on everything or not
		let cache_miss = false;
		for(let i = 0; i < model_list.length; i++){
			const model = model_list[i];
			if(model.cache_hit != true){
				cache_miss = true;
				break;
			}
		}
		
		if(cache_miss){
			// If we didn't hit the cache, wait for everything to resolve and then process (returns promise)
			return Promise.all(model_list)
			.then(
				model_list => {
					return this.process_models(model_list, merge)
				}
			)
		} else {
			// If we did hit the cache, return then process directly
			return this.process_models(model_list, merge)
		}
	}
	
	get_blockstates(model_name, is_item = false){
		const cache = this.blockstate_cache;
		if(cache[model_name] == undefined){
			cache[model_name] = {};
		}
		
		if(cache[model_name][is_item] != undefined){
			return cache[model_name][is_item]
		}
		
		cache[model_name][is_item] = this.get_blockstates_no_cache(...arguments)
		.then(
			function(data){
				cache[model_name][is_item] = add_cache_hit_flag(data);
				return data;
			}
		)
		
		return cache[model_name][is_item];
	}
	
	async get_blockstates_no_cache(){
		const block_loader = this.block_loader;
		
		return block_loader.get_blockstate_data(...arguments)
	}
}

export { ModelCache }
