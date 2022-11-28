import { load_filesystem } from "../load-file/main.js";
import { WorldReader } from "/packaged/node-modules.js"

class WorldLoader	{
	constructor(){
		this.world = undefined;
	}
	
	/**
	 * Adds a provided world
	 *
	 * @param   {String}   path  The file path of the world (.zip or a straight directory ending in /)
	 *
	 * @return  {Promise}        Resolves when the world is added
	 */
	async load_world(path){
		const world_files = await load_filesystem(path);
		this.world = new WorldReader(world_files)
		return this.world;
	}
	
	/**
	 * Returns the level data from the loaded world
	 *
	 * @return  {Object}  The world level data
	 */
	get_level_data(){
		return this.world.getLevelData();
	}
	
	/**
	 * Loads the blocks for a given chunk
	 *
	 * @param   {Number}  x  Coordinate of the chunk (x axis)
	 * @param   {Number}  z  Coordinate of the chunk (z axis)
	 *
	 * @return  {Object}     Information about the chunk
	 */
	load_chunk_blocks(x, z){
		return this.world.getRegionData(x, z)
		.catch(function(error){
			return {
				Sections: [],
				Position: [x, z]
			}
		})
	}

	/**
	 * Loads the entities for a given chunk
	 *
	 * @param   {Number}  x  Coordinate of the chunk (x axis)
	 * @param   {Number}  z  Coordinate of the chunk (z axis)
	 *
	 * @return  {Object}     Information about the chunk
	 */
	load_chunk_entities(x, z){
		return this.world.getEntityData(x, z)
		.catch(function(error){
			return {
				Entities: [],
				Position: [x, z]
			}
		})
	}
}

export { WorldLoader }
