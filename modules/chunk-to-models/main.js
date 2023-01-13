import { ModelCache } from "../model-cache/main.js";
import { THREE, CSG, CSGNode, BufferGeometryUtils } from "/packaged/node-modules.js"


const union_polygon_nodes = function(a, b){
	a.clipTo(b);
	b.clipTo(a);
	b.invert();
	b.clipTo(a);
	b.invert();
	a.build(b.allPolygons());
	
	return a;
}

const node_to_csg = function(node){
	return CSG.fromPolygons(node.allPolygons());
}


class Neighbours extends Object {
}


class SectionGrid {
	constructor(offset_y){
		this.y = offset_y;
		this.data = [];
		
		let grid = this.data;
		
		for(let y = 0; y < 16; y++){
			grid[y] = [];
			for(let z = 0; z < 16; z++){
				grid[y][z] = [];
				for(let x = 0; x < 16; x++){
					grid[y][z][x] = new GridArray();
				}
			}
		}
	}
	
	async load_data(data, palette, model_cache, process_geometry, check_blacklist){
		let grid = this.data;
		
		const palette_blockstate_promises = palette.map(model_data => model_cache.get_blockstates(model_data.Name));
		const palette_blockstates = await Promise.all(palette_blockstate_promises);
		
		for(let i = 0; i < data.length; i++){
			const x = i & 15;
			const y = (i >>> 8) & 15;
			const z = (i >>> 4) & 15;
			const id = data[i];
			const model_data = palette[id];
			const blockstate = palette_blockstates[id];
			
			if(blockstate.error == true){
				continue;
			}
			
			const name = model_data.Name;
			const options = model_data.Properties || {};
			
			let variant = model_cache.pick_variant(blockstate, options);
			if(variant.length == 0){
				console.log(name, blockstate, variant, options);
				continue;
			}
			
			let model = model_cache.get_model(variant)
			if(ModelCache.was_cache_miss(model)){
				model = await model;
			}
			
			if(check_blacklist(model)){
				continue;
			}
			
			const geometry = model.geometry;
			if(geometry.userData.is_valid == false){
				continue;
			}
			
			process_geometry(geometry, grid[y][z][x]);
		}
		
		return this;
	}
}

class Grid {
	constructor(){
		this.block_sections = {};
		this.entities = [];
	}
}

class GridArray {
	constructor(){
		this.is_full_block = false;
		this.transparent = {
			x_equal_low: false,
			x_equal_high: false,
			y_equal_low: false,
			y_equal_high: false,
			z_equal_low: false,
			z_equal_high: false
		}
		this.opaque = {
			x_equal_low: false,
			x_equal_high: false,
			y_equal_low: false,
			y_equal_high: false,
			z_equal_low: false,
			z_equal_high: false
		}
		
		this.transparent_materials = {};
		
		this.geometries = [];
	}
}

const wireframe = new THREE.MeshBasicMaterial({
	color: 0xff0000,
	wireframe: true
});

class ChunkToModels {
	constructor(model_cache = new ModelCache()){
		this.model_cache = model_cache;
		
		Object.defineProperty(this, 'materials', {
			get: function(){
				return this.model_cache.materials;
			},
			enumerable: true
		});
		
		this.side_info = {
			x_equal_low:	{ pairing: "x_equal_high",	offset_x: -1, offset_y: +0, offset_z: +0, broad: "x_low"	},
			x_equal_high:	{ pairing: "x_equal_low",	offset_x: +1, offset_y: +0, offset_z: +0, broad: "x_high"	},
			y_equal_low:	{ pairing: "y_equal_high",	offset_x: +0, offset_y: -1, offset_z: +0, broad: "y_low"	},
			y_equal_high:	{ pairing: "y_equal_low",	offset_x: +0, offset_y: +1, offset_z: +0, broad: "y_high"	},
			z_equal_low:	{ pairing: "z_equal_high",	offset_x: +0, offset_y: +0, offset_z: -1, broad: "z_low"	},
			z_equal_high:	{ pairing: "z_equal_low",	offset_x: +0, offset_y: +0, offset_z: +1, broad: "z_high"	}
		}
		
		this.broad_to_specific = {};
		for(let side_name in this.side_info){
			const side = this.side_info[side_name]
			this.broad_to_specific[side.broad] = side_name;
		}
	}
	
	separate_group(geometry, group_number){
		const groups = geometry.groups;
		
		const original_positions = geometry.getAttribute('position').array;
		const original_normals = geometry.getAttribute('normal').array;
		const original_uvs = geometry.getAttribute('uv').array;

		const group = groups[group_number];
		const material_index = group.materialIndex;
		const number_of_positions_in_group = group.count;

		const buffer_geometry = new THREE.BufferGeometry();
		const positions = new Float32Array(number_of_positions_in_group * 3);
		const normals = new Float32Array(number_of_positions_in_group * 3);
		const uvs = new Float32Array(number_of_positions_in_group * 2);

		for(let i = 0; i < number_of_positions_in_group; i++){
			const i3_original = 3 * (group.start + i);
			const i3_new = 3 * i;
				
			const i2_original = 2 * (group.start + i);
			const i2_new = 2 * i;

			positions[i3_new + 0] = original_positions[i3_original + 0];
			positions[i3_new + 1] = original_positions[i3_original + 1];
			positions[i3_new + 2] = original_positions[i3_original + 2];

			normals[i3_new + 0] = original_normals[i3_original + 0];
			normals[i3_new + 1] = original_normals[i3_original + 1];
			normals[i3_new + 2] = original_normals[i3_original + 2];
				
				
			uvs[i2_new + 0] = original_uvs[i2_original + 0];
			uvs[i2_new + 1] = original_uvs[i2_original + 1];
		}

		buffer_geometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
		buffer_geometry.setAttribute('normal', new THREE.Float32BufferAttribute(normals, 3));
		buffer_geometry.setAttribute('uv', new THREE.Float32BufferAttribute(uvs, 2));
		
		buffer_geometry.addGroup(0, number_of_positions_in_group, material_index)
		
		return buffer_geometry;
	}
	
	check_blacklist(model){
		return false;
	}
	
	find_in_grid(x, y, z, grid){
		if(grid == undefined){
			return { is_blank: true };
		}
		
		
		if(z < 0){
			return this.find_in_grid(x, y, z + 16, grid.z_low);
		}
		if(z >= 16){
			return this.find_in_grid(x, y, z - 16, grid.z_high);
		}
		if(x < 0){
			return this.find_in_grid(x + 16, y, z, grid.x_low);
		}
		if(x >= 16){
			return this.find_in_grid(x - 16, y, z, grid.x_high);
		}
		
		
		let section_y = Math.floor(y / 16) * 16;
		let offset_y = y - section_y;
		
		if(grid.block_sections[section_y] == undefined){
			return { is_blank: true };
		}
		
		return grid.block_sections[section_y].data[offset_y][z][x];
	}
	
	get_neighbours(grid, x, y, z){
		const neighbours = new Neighbours();
		const side_info = this.side_info;
		let is_solid = true;
		for(let side in side_info){
			const info = side_info[side];
			
			const sample_x = x + Number(info.offset_x);
			const sample_y = y + Number(info.offset_y);
			const sample_z = z + Number(info.offset_z);
			
			const neighbour = this.find_in_grid(sample_x, sample_y, sample_z, grid);
			
			neighbours[side] = neighbour
			if(neighbour.is_full_block != true){
				is_solid = false;
			}
		}
		
		neighbours.is_solid = is_solid;
		
		return neighbours;
	}
	
	geometry_find_valid_sides(geometry, grid, x, y, z, output_opaque, output_transparent){
		let geometry_clone;
		
		const side_info = this.side_info;
		const broad_to_specific = this.broad_to_specific;
		
		const groups = geometry.groups;
		const base_data = geometry.userData;
		if(base_data.groups == undefined){
			base_data.groups = []
		}
		
		const neighbours = this.get_neighbours(grid, x, y, z);
		
		if(geometry.is_full_block && neighbours.is_solid){
			return;
		}
		
		for(let g = 0; g < groups.length; g++){
			const group_data = base_data.groups[g] || {};
			const is_transparent = group_data.transparency;
			const material = group_data.material_uuid;
				
			let should_keep_group = true;
			// Check the valid sides in each group (valid sides are ones where the group is present)
			for(let broad_side in group_data.valid_sides){
				// Convert the side to the specific version (i.e. instead of >=16 it is =16)
				const side = broad_to_specific[broad_side];
				const info = side_info[side];
					
				// Get the matching side (i.e. top matches with bottom)
				const matching_side = info.pairing;
				
				const neighbour_info = neighbours[side];
				
				if(neighbour_info.is_full_block){
					should_keep_group = false;
					break;
				}
				if(neighbour_info.is_blank){
					continue;
				}
					
				// Gather the opaque/transparent matching sides information from the neighbour
				const neighbour_info_opaque = neighbour_info.opaque || {};
				const neighbour_matching_side_opaque = neighbour_info_opaque[matching_side];
					
				const neighbour_info_transparent = neighbour_info.transparent || {};
				const neighbour_matching_side_transparent = neighbour_info_transparent[matching_side];
					
				// If the neighbour has a matching opaque side, then we need to stop
				if(neighbour_matching_side_opaque == true){
					should_keep_group = false;
					break;
				}
				// If my side is transparent
				if(is_transparent){
					// and the neighbour has any transparent sides
					if(neighbour_matching_side_transparent == true){
						const neighbour_transparent_material_info = neighbour_info.transparent_materials || {};
						const neighbour_materials = neighbour_transparent_material_info[info.pairing] || [];
							
						// If the neighbour has matching transparent materials, we need to remove this group
						if(neighbour_materials.indexOf(material) >= 0){
							should_keep_group = false;
							break;
						}
					}
				}
			}
			
			if(should_keep_group){
				const material_index = group_data.materialIndex;
				
				if(geometry_clone == undefined){
					geometry_clone = geometry.clone();
					geometry_clone.translate(x, y, z)
				}
				
				const group_geometry = this.separate_group(geometry_clone, g);
				group_geometry.userData = {
					parent: group_data,
					x: x,
					y: y,
					z: z
				};
					
				if(is_transparent){
					output_transparent.geometries.push(group_geometry)
					output_transparent.material_indexes.push(material_index)
				} else {
					output_opaque.geometries.push(group_geometry)
					output_opaque.material_indexes.push(material_index)
				}
			}
		}
		
		if(geometry_clone != undefined){
			geometry_clone.dispose();
		}
	}
	
	
	merge_valid_sides(sections){
		let output = [];
		for(let i = 0; i < sections.length; i++){
			let section = sections[i];
			
			for(let name in section){
				if(section[name].geometries.length > 0){
					let geometry = BufferGeometryUtils.mergeBufferGeometries(section[name].geometries, true);
					for(let i = 0; i < geometry.groups.length; i++){
						geometry.groups[i].materialIndex = 	section[name].material_indexes[i];
						section[name].geometries[i].dispose();
					}
					// transparent_geometry = BufferGeometryUtils.mergeGroups(transparent_geometry)
					output.push(geometry);
					geometry.userData = {
						groups: geometry.userData.mergedUserData
					}
				}
			}
		}
		
		return output;
	}
	
	async convert_to_model(grid){
		let geometries = this.extract_geometries_from_grid(grid);
		
		let materials = this.materials;
		
		let trimmed_geometries = this.merge_valid_sides(geometries);
		
		
		let blocks = new THREE.Group();
		blocks.name = "blocks";
		for(let i = 0; i < trimmed_geometries.length; i++){
			let mesh = new THREE.Mesh(trimmed_geometries[i], materials);
			
			// mesh.material = wireframe;
			blocks.add(mesh)
		}
		
		let entities = new THREE.Group();
		entities.name = "entities";
		for(let i = 0; i < grid.entities.length; i++){
			let mesh = new THREE.Mesh(grid.entities[i], materials);
			entities.push(mesh);
		}
		
		let output = new THREE.Group();
		output.add(blocks)
		output.add(entities)
		
		return output
	}
	
	process_geometry(geometry, grid_cell){
		const geometry_data = geometry.userData;
		
		grid_cell.geometries.push(geometry)
			
		if(geometry_data.is_full_block == true){
			grid_cell.is_full_block = true;
		}
			
		let sides = geometry_data.sides;
		if(sides == undefined){
			return;
		}
		
		for(let type of ["transparent", "opaque"]){
			let type_info = sides[type];
			if(type_info == undefined){
				return;
			}
			for(let side in grid_cell[type]){
				grid_cell[type][side] = grid_cell[type][side] || type_info[side];
			}
		}
						
		const transparent_materials = sides.transparent_materials;
		for(let side in transparent_materials){
			if(grid_cell.transparent_materials[side] == undefined){
				grid_cell.transparent_materials[side]	= [];
			}
			grid_cell.transparent_materials[side].push(...transparent_materials[side])
		}
	}
	
	async add_blocks_to_grid(block_data, grid){
		let promises = [];
		for(let i = 0; i < block_data.length; i++){
			const section = block_data[i];
			
			const offset_y = section.offset_y;
			const data = section.data;
			const palette = section.palette;
			
			const section_grid = new SectionGrid(offset_y);
			let promise = section_grid.load_data(data, palette, this.model_cache, this.process_geometry, this.check_blacklist);
			promise.then(
				function(){
					grid.block_sections[offset_y] = section_grid;
				}
			)
			
			promises.push(promise)
		}
		
		await Promise.all(promises);
	}
	
	async add_geometry_to_grid_section(geometry, grid, x, y, z){
		let section_y = Math.floor(y / 16) * 16;
		let offset_y = y - section_y;
		if(grid.block_sections[section_y] == undefined){
			return false;
		}
		this.process_geometry(geometry, grid.block_sections[section_y].data[offset_y][z][x]);
		return true;
	}
	
	
	async add_entities_to_grid(entities, grid){
		for(let i = 0; i < entities.length; i++){
			const entity = entities[i];
			const model_data = entity.data;
			const x = entity.x;
			const y = entity.y;
			const z = entity.z;
			
			const name = model_data.Name;
			const options = model_data.Properties || {};
			
			let blockstate = this.model_cache.get_blockstates(name, true);
			if(ModelCache.was_cache_miss(blockstate)){
				blockstate = await blockstate;
			}
			
			if(blockstate.error == true){
				continue;
			}
			
			let variant = this.model_cache.pick_variant(blockstate, options);
			if(variant.length == 0){
				console.log(name, blockstate, variant, options);
				continue;
			}
			
			let model = this.model_cache.get_model(variant)
			if(ModelCache.was_cache_miss(model)){
				model = await model;
			}
			
			if(this.check_blacklist(model)){
				continue;
			}
			
			const geometry = model.geometry;
			if(geometry.userData.is_valid == false){
				continue;
			}
			
			let is_block_aligned = false;
			if(x - Math.floor(x) == 0){
				if(y - Math.floor(x) == 0){
					if(z - Math.floor(x) == 0){
						is_block_aligned = true;
					}
				}
			}
			
			if(is_block_aligned){
				is_block_aligned = add_entity_to_grid_section(geometry, grid, x, y, z);
			}
			
			if(!is_block_aligned){
				geometry_clone = geometry.clone();
				geometry_clone.translate(x, y, z)
				
				grid.entities.push(geometry_clone)
			}
		}
	}
	
	async convert_to_grid(chunk_data){
		const grid = new Grid();
		
		const blocks = chunk_data.data.blocks;
		const entities = chunk_data.data.entities;
		
		await this.add_blocks_to_grid(blocks, grid);
		await this.add_entities_to_grid(entities, grid);
		
		return grid;
	}
	
	extract_geometries_from_grid(parent_grid){
		let output = [];
		let sections = parent_grid.block_sections;
		for(let offset in sections){
			// Expand this function to also take neighbouring grids
			const opaque = {
				geometries: [],
				material_indexes: []
			}
			const transparent = {
				geometries: [],
				material_indexes: []
			}
			
			output.push({
				opaque: opaque,
				transparent: transparent
			})
			
			let section = sections[offset];
			
			let grid = section.data;
			let offset_y = section.y;
		
			for(let y in grid){
				const y_data = grid[y];
				for(let z in y_data){
					const z_data = y_data[z];
					for(let x in z_data){
						const stored_geometries = z_data[x].geometries;
					
						const position_x = Number(x)
						const position_y = Number(y) + offset_y;
						const position_z = Number(z)
						
					
						for(let i = 0; i < stored_geometries.length; i++){
							const parent_geometry = stored_geometries[i];
						
							this.geometry_find_valid_sides(parent_geometry, parent_grid, position_x, position_y, position_z, opaque, transparent);
						}
					}
				}
			}
		}
		
		// console.log(output)
		
		return output;
	}
}
 
export { ChunkToModels }
