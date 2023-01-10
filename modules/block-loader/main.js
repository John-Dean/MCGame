import { BlockModelFactory, ResourcePack, ResourceManager, ResourceLocation, ModelLoader } from "/packaged/node-modules.js"
import { load_filesystem } from "../load-file/main.js";

class BlockLoader {
	constructor(){
		this.resource_manager = new ResourceManager();
		this.model_loader = new ModelLoader(this.resource_manager);
		
		this.block_model_factory = new BlockModelFactory(this.model_loader.textures);
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
		let replace_string = "blockstates";
		if(is_item){
			replace_string = "models/item";
		}
		
		let model_file_info = ResourceLocation.ofBlockModelPath(model_name);
		let blockstate_file_path = model_file_info.path.replace("models/block", replace_string);
		blockstate_file_path = "/assets/minecraft/" + blockstate_file_path;
		
		let blockstate = {};
		for(let i = 0; i < this.resource_manager.list.length; i++){
			let resource_pack	=		this.resource_manager.list[i];
			let exists	=	await resource_pack.source.fs.existsFile(blockstate_file_path);
			if(exists){
				blockstate = 	await resource_pack.source.fs.readFile(blockstate_file_path, "utf-8");
				blockstate = JSON.parse(blockstate);
				break;
			}
		}
					
		return blockstate;
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
		return this.model_loader.loadModel(model_name);
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
