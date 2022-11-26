import {ModelCache} from "../model-cache/main.js";
import { THREE } from "/packaged/node-modules.js"


class ChunkToModels {
	constructor(model_cache = new ModelCache()){
		this.model_cache = model_cache;
	}
	
	async convert_to_model(chunk_data){
		let data = chunk_data.data;
		let models = [];
		for(let i = 0; i < data.length; i++){
			const instance = data[i];
			const model_data = instance.data;
			const x = instance.x;
			const y = instance.y;
			const z = instance.z;
			
			const name = model_data.Name;
			const options = model_data.Properties || {};
			const is_item = options.is_item || false;
			

			let blockstate = await this.model_cache.get_blockstates(name, is_item);
			let variant = await this.model_cache.pick_variant(blockstate, options);
			if(variant.length == 0){
				console.log(name, blockstate, variant, options);
				continue;
			}
			let model = await this.model_cache.get_model(variant)
			
			let clean_model = new THREE.Mesh(model.geometry, model.material);
			
			clean_model.position.set(x, y, z);
			
			models.push(clean_model)
		}
		console.log(models)
		
		return models;
	}
}
 
export { ChunkToModels }
