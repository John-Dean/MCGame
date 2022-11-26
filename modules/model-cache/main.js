import { VariantSelector } from "../blockstate-variant-selector/main.js";
import { BlockLoader } from "../block-loader/main.js";
import { ModelCleaner } from "../model-cleaner/main.js";

/**
 * @borrows BlockLoader.add_resource_pack as add_resource_pack
 */
class ModelCache {
	constructor(model_cache = {}, blockstate_cache = {}){
		this.model_cache =	model_cache;
		this.blockstate_cache =	blockstate_cache;
		this.block_loader = new BlockLoader();
		this.model_cleaner = new ModelCleaner();
		
		this.variant_selector = VariantSelector;
	}
	
	add_resource_pack(name){
		return this.block_loader.add_resource_pack(...arguments)
	}
	
	async pick_variant(blockstates, options){
		return this.variant_selector.pick_blockstate(blockstates, options);
	}
	
	async get_model(model_name, options){
		if(typeof model_name === "object"){
			if(model_name instanceof Array){
				return this.get_models(...arguments)
			}
			options = model_name;
			model_name = options.model;
		}
		
		let cache = this.model_cache;
		if(cache[model_name] == undefined){
			cache[model_name] = {};
		}
		let model_cache = cache[model_name];
		
		let uv_lock = options.uvlock || false;
		let x = options.x || 0;
		let y = options.y || 0;
		
		if(model_cache[uv_lock] == undefined){
			model_cache[uv_lock] = {};
		}
		if(model_cache[uv_lock][x] == undefined){
			model_cache[uv_lock][x] = {};
		}
		if(model_cache[uv_lock][x][y] == undefined){
			model_cache[uv_lock][x][y] = this.get_model_no_cache(model_name, options);
		}
		
		return await model_cache[uv_lock][x][y]
	}
	
	async get_model_no_cache(model_name, options){
		const block_loader = this.block_loader;
		const model_cleaner = this.model_cleaner;
		
		let model_data = await block_loader.get_model_data(model_name);
		
		let model = await block_loader.get_model(model_data, options);
		
		let clean_model = await model_cleaner.clean_model(model)
		
		return clean_model;
	}
	
	async get_models(model_name_list, merge = true){
		let models_promises = model_name_list.map(model => this.get_model(model));
		let model_list = await Promise.all(models_promises)
		
		if(merge){
			return this.model_cleaner.merge_models(model_list);
		}
		return model_list
	}
	
	async get_blockstates(model_name, is_item = false){
		let cache = this.blockstate_cache;
		let data = cache[model_name];
		if(cache[model_name] == undefined){
			cache[model_name] = {};
		}
		
		if(cache[model_name][is_item] != undefined){
			return cache[model_name][is_item]
		}
		
		cache[model_name][is_item] = this.get_blockstates_no_cache(...arguments);
		
		return await cache[model_name][is_item];
	}
	
	async get_blockstates_no_cache(){
		const block_loader = this.block_loader;
		
		return block_loader.get_blockstate_data(...arguments);
	}
}

export { ModelCache }
