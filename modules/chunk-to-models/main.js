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

class GridArray extends Array {
	constructor(){
		super();
		Object.defineProperty(this, 'is_full_block', {
			value: false,
			writable: true,
			enumerable: false
		});
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
	
	process_grid(grid){
		for(let y in grid){
			let y_data = grid[y];
			for(let z in y_data){
				let z_data = y_data[z];
				for(let x in z_data){
					let geometries = z_data[x];
					
					if(geometries.length == 1){
						z_data[x] = geometries[0].userData.sides;
						continue;
					}
					
					const output = {
						transparent: {
							x_equal_low: false,
							x_equal_high: false,
							y_equal_low: false,
							y_equal_high: false,
							z_equal_low: false,
							z_equal_high: false
						},
						opaque: {
							x_equal_low: false,
							x_equal_high: false,
							y_equal_low: false,
							y_equal_high: false,
							z_equal_low: false,
							z_equal_high: false
						},
						transparent_materials: {}
					}
					
					for(let i = 0; i < geometries.length; i++){
						const geometry = geometries[i];
						let sides = geometry.userData.sides;
						if(sides == undefined){
							continue
						}
						for(let type of ["transparent", "opaque"]){
							let type_info = sides[type];
							if(type_info == undefined){
								continue;
							}
							for(let side in output[type]){
								output[type][side] = output[type][side] || type_info[side];
							}
						}
						
						const transparent_materials = sides.transparent_materials;
						for(let side in transparent_materials){
							if(output.transparent_materials[side] == undefined){
								output.transparent_materials[side]	= [];
							}
							output.transparent_materials[side].push(...transparent_materials[side])
						}
					}
					
					z_data[x] = output;
				}
			}
		}
	}
	
	find_in_grid(x, y, z, grid){
		const y_info = grid[y];
		if(y_info == undefined){
			return {};
		}
		const z_info = y_info[z];
		if(z_info == undefined){
			return {};
		}
		const x_info = z_info[x];
		if(x_info == undefined){
			return {}
		}
		return x_info;
	}
	
	find_valid_sides(geometries, grid){
		if(geometries.length == 0){
			throw "No geometries provided"
		}
		
		const side_info = this.side_info;
		const broad_to_specific = this.broad_to_specific;
		
		const valid_geometries_transparent = [];
		const valid_material_indexes_transparent = [];
		const valid_geometries_opaque = [];
		const valid_material_indexes_opaque = [];
		
		
		for(let i = 0; i < geometries.length; i++){
			const geometry = geometries[i];
			const groups = geometry.groups;
			const geometry_data = geometry.userData;
			const base_data = geometry_data.parent;
			const x = Number(geometry_data.x);
			const y = Number(geometry_data.y);
			const z = Number(geometry_data.z);
			const neighbours = {};
			for(let g = 0; g < groups.length; g++){
				const group_data = base_data.groups[g];
				const transparent = group_data.transparency;
				const material = group_data.material_uuid;
				const material_index = group_data.materialIndex;
				
				let should_keep_group = true;
				// Check the valid sides in each group (valid sides are ones where the group is present)
				for(let broad_side in group_data.valid_sides){
					// Convert the side to the specific version (i.e. instead of >=16 it is =16)
					const side = broad_to_specific[broad_side];
					const info = side_info[side];
					
					// Get the matching side (i.e. top matches with bottom)
					const matching_side = info.pairing;
					
					// If we haven't already fetched the neighbour, fetch them
					if(neighbours[side] == undefined){
						const sample_x = x + Number(info.offset_x);
						const sample_y = y + Number(info.offset_y);
						const sample_z = z + Number(info.offset_z);
						neighbours[side] = this.find_in_grid(sample_x, sample_y, sample_z, grid);
					}
					const neighbour_info = neighbours[side];
					
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
					if(transparent){
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
					const group_geometry = this.separate_group(geometry, g);
					group_geometry.userData = group_data;
					
					if(transparent){
						valid_geometries_transparent.push(group_geometry)
						valid_material_indexes_transparent.push(material_index)
					} else {
						valid_geometries_opaque.push(group_geometry)
						valid_material_indexes_opaque.push(material_index)
					}
				}
			}
		}
		
		return {
			transparent: {
				geometries: valid_geometries_transparent,
				material_indexes: valid_material_indexes_transparent
			},
			opaque: {
				geometries: valid_geometries_opaque,
				material_indexes: valid_material_indexes_opaque
			}
		}
	}
	
	merge_valid_sides(valid_sides){
		let output = [];
		if(valid_sides.transparent.geometries.length > 0){
			let transparent_geometry = BufferGeometryUtils.mergeBufferGeometries(valid_sides.transparent.geometries, true);
			for(let i = 0; i < transparent_geometry.groups.length; i++){
				transparent_geometry.groups[i].materialIndex = 	valid_sides.transparent.material_indexes[i];
			}
			// transparent_geometry = BufferGeometryUtils.mergeGroups(transparent_geometry)
			output.push(transparent_geometry);
		}
			
		if(valid_sides.opaque.geometries.length > 0){
			let opaque_geometry = BufferGeometryUtils.mergeBufferGeometries(valid_sides.opaque.geometries, true);
			for(let i = 0; i < opaque_geometry.groups.length; i++){
				opaque_geometry.groups[i].materialIndex = 	valid_sides.opaque.material_indexes[i];
			}
		
			// opaque_geometry = BufferGeometryUtils.mergeGroups(opaque_geometry)
			output.push(opaque_geometry);
		}
		console.log(valid_sides)
		
		return output;
	}
	
	async convert_to_model(chunk_data){
		const [geometries, grid] = await this.get_geometries_and_grid(chunk_data);
		
		let materials = this.materials;
		
		this.process_grid(grid)
		// console.log(grid)
		const valid_sides = this.find_valid_sides(geometries, grid);
		
		let trimmed_geometries = this.merge_valid_sides(valid_sides);
		console.log(trimmed_geometries)
		
		let meshes = new THREE.Group();
		for(let i = 0; i < trimmed_geometries.length; i++){
			let mesh = new THREE.Mesh(trimmed_geometries[i], materials);
			
			// mesh.material = wireframe;
			meshes.add(mesh)
		}
		
		meshes.userData = grid;
		
		return meshes
	}
	
	async convert_to_grid(chunk_data){
		const output_grid = {};
		
		const data = chunk_data.data;
		for(let i = 0; i < data.length; i++){
			const instance = data[i];
			const model_data = instance.data;
			const x = instance.x;
			const y = instance.y;
			const z = instance.z;
			
			const name = model_data.Name;
			const options = model_data.Properties || {};
			const is_item = options.is_item || false;
			
			let blockstate = this.model_cache.get_blockstates(name, is_item);
			if(ModelCache.was_cache_miss(blockstate)){
				blockstate = await blockstate;
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
			
			const geometry = model.geometry;
			const geometry_data = geometry.userData;
			
			if(geometry.userData.is_valid == false){
				continue;
			}
			
			if(output_grid[y] == undefined){
				output_grid[y] = []
			}
			if(output_grid[y][z] == undefined){
				output_grid[y][z] = []
			}
			if(output_grid[y][z][x] == undefined){
				output_grid[y][z][x] = new GridArray();
			}
			output_grid[y][z][x].push(geometry)
			
			if(geometry_data.is_full_block == true){
				output_grid[y][z][x].is_full_block = true;
			}
		}
		
		return output_grid;
	}
	
	extract_geometries_from_grid(grid){
		const geometries = [];
		
		const side_info = this.side_info;
		for(let y in grid){
			const y_data = grid[y];
			for(let z in y_data){
				const z_data = y_data[z];
				for(let x in z_data){
					const stored_geometries = z_data[x];
					
					const position_x = Number(x)
					const position_y = Number(y)
					const position_z = Number(z)
					
					for(let i = 0; i < stored_geometries.length; i++){
						const parent_geometry = stored_geometries[i];
						const geometry_data = parent_geometry.userData;
						const is_full_block = geometry_data.is_full_block;
						
						let should_clone_geometry = false;
						if(is_full_block){
							for(let side in side_info){
								const info = side_info[side];
								const sample_x = position_x + Number(info.offset_x);
								const sample_y = position_y + Number(info.offset_y);
								const sample_z = position_z + Number(info.offset_z);
								
								const neighbour_info = this.find_in_grid(sample_x, sample_y, sample_z, grid);
								
								if(neighbour_info.is_full_block != true){
									should_clone_geometry = true;
									break;
								}
							}
						} else {
							should_clone_geometry = true;
						}
						
						if(should_clone_geometry){
							const geometry = parent_geometry.clone();
							geometry.translate(position_x, position_y, position_z)
														
							geometry.userData = {
								x: position_x,
								y: position_y,
								z: position_z,
								parent: geometry_data
							}
							
							geometries.push(geometry);
						}
					}
				}
			}
		}
		
		return geometries;
	}
	
	async get_geometries_and_grid(chunk_data){
		const grid = await this.convert_to_grid(chunk_data)
		
		const geometries = this.extract_geometries_from_grid(grid);
		
		return [geometries, grid]
	}
}
 
export { ChunkToModels }
