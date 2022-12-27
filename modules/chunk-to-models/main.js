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

class ChunkToModels {
	constructor(model_cache = new ModelCache()){
		this.model_cache = model_cache;
		
		this.side_info = {
			x_equal_low:	{ pairing: "x_equal_high",	offset_x: -1, offset_y: +0, offset_z: +0, broad: "x_low" },
			x_equal_high:	{ pairing: "x_equal_low",	offset_x: +1, offset_y: +0, offset_z: +0, broad: "x_high" },
			y_equal_low:	{ pairing: "y_equal_high",	offset_x: +0, offset_y: -1, offset_z: +0, broad: "y_low" },
			y_equal_high:	{ pairing: "y_equal_low",	offset_x: +0, offset_y: +1, offset_z: +0, broad: "y_high" },
			z_equal_low:	{ pairing: "z_equal_high",	offset_x: +0, offset_y: +0, offset_z: -1, broad: "z_low" },
			z_equal_high:	{ pairing: "z_equal_low",	offset_x: +0, offset_y: +0, offset_z: +1, broad: "z_high" }
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
	
	merge_geometries(geometries, grid){
		if(geometries.length == 0){
			throw "No geometries provided"
		}
		
		const side_info = this.side_info;
		
		let valid_geometries_transparent = [];
		let valid_material_indexes_transparent = [];
		let valid_geometries_opaque = [];
		let valid_material_indexes_opaque = [];
		
		let transparent_material_record = {};
		
		for(let i = 0; i < geometries.length; i++){
			const geometry = geometries[i];
			const x = geometry.userData.x;
			const y = geometry.userData.y;
			const z = geometry.userData.z;
			
			let removed_sides = { transparent: [], opaque: [] };
			
			const sides = geometry.userData.parent.sides;
			for(let type in sides){
				for(let side in side_info){
					const info = side_info[side];
					
					if(sides[type][side] == true){
						let sample_x = Number(x) + Number(info.offset_x);
						let sample_y = Number(y) + Number(info.offset_y);
						let sample_z = Number(z) + Number(info.offset_z);
						
						let neighbour_info = this.find_in_grid(sample_x, sample_y, sample_z, grid);
						let type_info = neighbour_info[type] || {};
						if(type_info[info.pairing] == true){
							removed_sides[type].push(side);
							
							
							if(type == "transparent"){
								if(transparent_material_record[side] == undefined){
									transparent_material_record[side] = {};
								}
								
								let transparent_material_info = neighbour_info.transparent_materials || {};
								let materials = transparent_material_info[info.pairing] || [];
								
								for(let i = 0; i < materials.length; i++){
									let uuid = materials[i];
									transparent_material_record[side][uuid] = true;
								}
							}
						}
					}
				}
			}
			
						
			const groups = geometry.groups;
			let valid_groups = [];
			for(let g = 0; g < groups.length; g++){
				const group_data = geometry.userData.parent.groups[g];
				
				const transparent = group_data.transparency;
				let prefixes = ["opaque"];
				if(transparent){
					prefixes.push("transparent");
				}
				
				
				let is_valid = true;
				for(let p = 0; p < prefixes.length; p++){
					const prefix = prefixes[p];
					for(let i = 0; i < removed_sides[prefix].length; i++){
						const base_side = removed_sides[prefix][i];
						// This will handle any groups that exceed the block bounds
						const side = side_info[base_side].broad;
						if(group_data.sides[side] == true){
							// Transparent faces should get culled if next to opaque faces, or same material transparent faces
							if(transparent && prefix == "transparent"){
								let transparent_materials = transparent_material_record[base_side];
								let material = group_data.material_uuid;
								if(transparent_materials[material] != true){
									continue;
								}
							}
						
							is_valid = false;
							break;
						}
					}
					
					if(!is_valid){
						break;
					}
				}
				if(is_valid){
					valid_groups.push(g);
				}
			}
			
			if(valid_groups.length == 0){
				continue;
			}
			
			for(let i = 0; i < valid_groups.length; i++){
				const group_number = valid_groups[i];
				const group_geometry = this.separate_group(geometry, group_number);
				const material_index = group_geometry.groups[0].materialIndex;
				const is_transparent = geometry.userData.parent.groups[group_number].transparent;
				if(is_transparent){
					valid_geometries_transparent.push(group_geometry)
					valid_material_indexes_transparent.push(material_index)
				} else {
					valid_geometries_opaque.push(group_geometry)
					valid_material_indexes_opaque.push(material_index)
				}
			}
		}
		
		let output = [];
		if(valid_geometries_transparent.length > 0){
			let transparent_geometry = BufferGeometryUtils.mergeBufferGeometries(valid_geometries_transparent, true);
			for(let i = 0; i < transparent_geometry.groups.length; i++){
				transparent_geometry.groups[i].materialIndex = 	valid_material_indexes_transparent[i];
			}
			// transparent_geometry = BufferGeometryUtils.mergeGroups(transparent_geometry)
			output.push(transparent_geometry);
		}
			
		if(valid_geometries_opaque.length > 0){
			let opaque_geometry = BufferGeometryUtils.mergeBufferGeometries(valid_geometries_opaque, true);
			for(let i = 0; i < opaque_geometry.groups.length; i++){
				opaque_geometry.groups[i].materialIndex = 	valid_material_indexes_opaque[i];
			}
		
			// opaque_geometry = BufferGeometryUtils.mergeGroups(opaque_geometry)
			output.push(opaque_geometry);
		}
		return output;
	}
	
	async convert_to_model(chunk_data){
		const [geometries, material, grid] = await this.get_geometries_and_materials(chunk_data);
		
		this.process_grid(grid)
		// console.log(grid)
		let merged_geometries = this.merge_geometries(geometries, grid);
		let meshes = [];
		for(let i = 0; i < merged_geometries.length; i++){
			let mesh = new THREE.Mesh(merged_geometries[i], material);
			const wireframe = new THREE.MeshBasicMaterial({
				color: 0xff0000,
				wireframe: true
			});
			// mesh.material = wireframe;
			meshes.push(mesh)
		}
		
		
		return meshes
	}
	
	async get_geometries_and_materials(chunk_data, should_presort_geometry = true){
		const materials = this.model_cache.materials;
		const wireframe = new THREE.MeshBasicMaterial({
			color: 0xff0000,
			wireframe: true
		});
		
		let output_grid = {};
		
		let data = chunk_data.data;
		let geometries = [];
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
			
			if(!should_presort_geometry){
				geometries.push(geometry);
			}
		}
		
		if(should_presort_geometry){
			const side_info = this.side_info;
			for(let y in output_grid){
				const y_data = output_grid[y];
				for(let z in y_data){
					const z_data = y_data[z];
					for(let x in z_data){
						const stored_geometries = z_data[x];
						const is_full_block = stored_geometries.is_full_block;
						let count = 0;
					
						if(is_full_block){
							for(let side in side_info){
								const info = side_info[side];
								const sample_x = Number(x) + Number(info.offset_x);
								const sample_y = Number(y) + Number(info.offset_y);
								const sample_z = Number(z) + Number(info.offset_z);
							
								const neighbour_info = this.find_in_grid(sample_x, sample_y, sample_z, output_grid);
							
								if(neighbour_info.is_full_block == true){
									count++;
								} else {
									break;
								}
							}
						}
					
						if(count < 6){
							const cloned_geometries = stored_geometries.map(parent_geometry => {
								const geometry = parent_geometry.clone();
								const position_x = Number(x)
								const position_y = Number(y)
								const position_z = Number(z)
								
								geometry.translate(position_x, position_y, position_z)
			
								const parent_data = parent_geometry.userData;
								geometry.userData = { x: position_x, y: position_y, z: position_z, parent: parent_data }
								
								return geometry;
							});
							
							geometries.push(...cloned_geometries);
						}
					}
				}
			}
		}
		
		return [geometries, materials, output_grid]
	}
}
 
export { ChunkToModels }
