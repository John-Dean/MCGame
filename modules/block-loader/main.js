import { BlockModelFactory, ResourcePack, ResourceManager, ResourceLocation, ModelLoader } from "/packaged/node-modules.js"
import { load_filesystem } from "../load-file/main.js";
import {ResourceTextureManager} from "../texture-manager/main.js";

class BlockLoader {
	constructor(){
		this.resource_manager = new ResourceManager();
		this.model_loader = new ModelLoader(this.resource_manager);
		
		this.texture_manager = new ResourceTextureManager(this.model_loader.textures);
		
		this.block_model_factory = new BlockModelFactory(this.texture_manager);
	}
	
	get models(){
		return this.model_loader.models;
	}
	
	get textures(){
		return this.model_loader.textures;
	}
	
	/**
	 * Returns the blockstates for a given block
	 *
	 * @param   {String}   model_name  Name of the model to find
	 * @param   {Boolean}  [is_item]   If looking up the item block state
	 *
	 * @return  {Object}               Contents of the blockstate file for that model
	 */
	async get_blockstate_data(model_name, is_item = false){
		try{
			let model_file_info;
			if(is_item){
				model_file_info = ResourceLocation.ofItemModelPath(model_name);
			} else {
				model_file_info = ResourceLocation.ofBlockStatePath(model_name);
			}
			
			let file = await this.resource_manager.get(model_file_info);
			let file_contents = await file.read("utf-8");
			return JSON.parse(file_contents);
		}catch(error){
			return {error: true};	
		}
	}
	
	/**
	 * Adds a provided resource pack to the resource manager
	 *
	 * @param   {String}   url  The URL of the pack (.zip or a straight directory ending in /)
	 *
	 * @return  {Promise}       Resolves when the resource pack is added
	 */
	async add_resource_pack(url){
		const resource_pack_files = await load_filesystem(url);
		const pack = await ResourcePack.open(resource_pack_files)
		return this.resource_manager.addResourcePack(pack);
	}
	
	/**
	 * Gets the given model data from the texture pack
	 *
	 * @param   {String}  model_name  Name of the model to find
	 *
	 * @return  {Object}              The model data from the texture pack
	 */
	get_model_data(model_name){
		return this.model_loader.loadModel(...arguments);
	}
	
	/**
	 * Gets a THREE model of a block type object
	 *
	 * @param   {Object}  model_data  Obtained via get_model_data
	 * @param   {Object}  options     { uvlock?: boolean; y?: number; x?: number }
	 *
	 * @return  {BlockModelObject}      Model of the block
	 */
	get_model(model_data, options){
		if(model_data.elements == undefined){
			model_data.elements = []
		}
		return this.block_model_factory.getObject(model_data, options)
	}
}

export { BlockLoader }
