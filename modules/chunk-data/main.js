import { RegionReader } from "/packaged/node-modules.js"
import { WorldLoader } from "../world-loader/main.js"

class Entity {
	constructor(x, y, z, data){
		this.x = x;
		this.y = y;
		this.z = z;
		this.data = data;
		
		if(data.Name == "minecraft:air"){
			console.trace();
			debugger;
		}
	}
}

class ChunkData {
	constructor(){
		this.world = new WorldLoader();
		this.region_reader = RegionReader;
	}
	
	load_world(){
		return this.world.load_world(...arguments);
	}
	
	add_section(section, output){
		const offset_y = (section.Y * 16)
		
		const palette = section.Palette || (section.block_states || {}).palette;
		const block_states = section.BlockStates || (section.block_states || {}).data;
		
		let chunk_data;
		
		if(block_states == undefined){
			if(palette == undefined){
				return;
			}
			if(palette.length != 1 || palette[0] == undefined){
				return;	
			}
			
			const block_data	=	palette[0];
			if(block_data.Name == "minecraft:air"){
				return;
			}
			
			chunk_data = new Uint8Array(16*16*16);
		} else {
			let chunk_data_array = this.region_reader.getSectionBlockIdArray(section)
			chunk_data = chunk_data_array;
			
			// for(let i = 0; i < chunk_data_array.length; i++){
			// 	let x = i & 15;
			// 	let y = (i >>> 8) & 15;
			// 	let z = (i >>> 4) & 15;
			// 	let id = chunk_data_array[i];
				
			// 	const block_x	=	x;
			// 	const block_y	=	y + offset_y;
			// 	const block_z	=	z;
				
			// 	const block_data	=	palette[id];
				
			// 	if(block_data != undefined){
			// 		if(block_data.Name != "minecraft:air"){
			// 			output.push(new ModelInstance(block_x, block_y, block_z, block_data));
			// 		}
			// 	}
			// }
		}
		
		output.push({
			offset_y: offset_y,
			data: chunk_data,
			palette: palette	
		})
	}
	
	add_blocks(blocks, output){
		const sections = blocks.sections || (blocks.Level || {}).Sections || []
		for(let i = 0; i < sections.length; i++){
			const section = sections[i];
			this.add_section(section, output);
		}
	}
	
	add_entities(entities_object, output, chunk_x, chunk_z){		
		const x_offset = (chunk_x * 16);
		const z_offset = (chunk_z * 16);
		
		const entities = entities_object.Entities || [];
		for(let i = 0; i < entities.length; i++){
			const entity = entities[i];
			const x = entity.TileX - x_offset;
			const y = entity.TileY;
			const z = entity.TileZ - z_offset;
			
			if(entity.id == "minecraft:item_frame"){
				const item = entity.Item;
				if(item == undefined){
					continue;
				}
				
				const name = entity.Item.id;
				const tags = (entity.Item.tag || {})
				const custom_model_data = tags.CustomModelData || tags.custom_model_data || 0;
				
				
				let facing = entity.Facing;
				if(facing == 0){
					facing = "down"
				}
				if(facing == 1){
					facing = "up"
				}
				if(facing == 2){
					facing = "north"
				}
				if(facing == 3){
					facing = "south"
				}
				if(facing == 4){
					facing = "west"
				}
				if(facing == 5){
					facing = "east"
				}
				
				const data = {
					Name: name,
					Properties: {
						custom_model_data: custom_model_data,
						facing: facing,
						rotation: entity.ItemRotation,
						is_item: true
					}
				}
				
				if(name != "minecraft:air"){
					output.push(new Entity(x, y, z, data));
				}
			}
		}
	}
	
	async get_chunk_data(x, z){
		let blocks = await this.world.load_chunk_blocks(x, z);
		let entities;
		if(blocks.Level.Entities != undefined){
			entities = blocks.Level;
		} else {
			entities = await this.world.load_chunk_entities(x, z); ;
		}
		
		let chunk_data = {
			blocks: [],
			entities: []
		};
		this.add_blocks(blocks, chunk_data.blocks);
		this.add_entities(entities, chunk_data.entities, x, z);
		
		const output = {}
		output.x = x;
		output.z = z;
		output.data = chunk_data;
		
		// console.log(output)
		return output;
		// console.log(blocks)
	}
}

export { ChunkData }
