import { VariantSelector } from "../blockstate-variant-selector/main.js";
import { BlockLoader } from "../block-loader/main.js";
import { ModelCleaner } from "../model-cleaner/main.js";
import { THREE } from "/packaged/node-modules.js"

import { GeometryPointArray } from "../geometry_point_array/main.js";

const add_cache_hit_flag = function(object){
	Object.defineProperty(object, 'cache_hit', {
		value: true,
		writable: false,
		enumerable: false
	});
	
	return object;
}

const was_cache_miss = function(object){
	if(object.cache_hit === true){
		return false;
	}
	return true;
}



class ModelCache {
	constructor(model_cache = {}, blockstate_cache = {}){
		this.model_cache =	model_cache;
		this.blockstate_cache =	blockstate_cache;
		this.block_loader = new BlockLoader();
		this.model_cleaner = new ModelCleaner();
		
		this.materials_index = {}
		this.materials = []
		
		this.variant_selector = VariantSelector;
		
		this.base_sides = {
			x_low: true,
			x_high: true,
			y_low: true,
			y_high: true,
			z_low: true,
			z_high: true
		}
	}
	
	static was_cache_miss = was_cache_miss;
	
	add_resource_pack(){
		return this.block_loader.add_resource_pack(...arguments)
	}
	
	pick_variant(){
		return this.variant_selector.pick_blockstate(...arguments)
	}

	check_material(material){
		if(material.map != null){
			const texture = material.map;
			texture.wrapS = THREE.RepeatWrapping;
			texture.wrapT = THREE.RepeatWrapping;
		}
	}

	remap_model(model){
		const global_materials_index = this.materials_index;
		const global_materials = this.materials;
		
		let materials = model.material;
		if(!(materials instanceof Array)){
			materials = [materials];
		}
		
		// Add all the materials to the global list, and calculate the mappings
		const mapping = new Array(materials.length);
		for(let i = 0; i < materials.length; i++){
			const material = materials[i];
			const uuid = material.uuid;
			let material_index = global_materials_index[uuid];
			
			if(material_index == undefined){
				material_index = global_materials.length;
				global_materials_index[uuid] = material_index;
				global_materials[material_index] = material;
				this.check_material(material);
			}
			
			mapping[i] = material_index;
		}
		
		// Remap the groups to the new materials
		const geometry = model.geometry;
		const groups = geometry.groups;
		
		for(let i = 0; i < groups.length; i++){
			const group = groups[i];
			group.materialIndex = mapping[group.materialIndex]
		}
		
		// Swap the materials list to the global list
		model.material = global_materials;
		
		return model;
	}
	
	get_model(model_name, options = {}){
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
	
	identify_points_sides(model){
		const geometry = model.geometry;
		const positions = geometry.getAttribute('position').array;
		
		const position_info = [];
		
		for(let i = 0; i < positions.length; i += 3){
			const output = {
				x_low: false,
				x_equal_low: false,
				x_high: false,
				x_equal_high: false,
				y_low: false,
				y_equal_low: false,
				y_high: false,
				y_equal_high: false,
				z_low: false,
				z_equal_low: false,
				z_high: false,
				z_equal_high: false
			};
			
			const x = positions[i + 0];
			const y = positions[i + 1];
			const z = positions[i + 2];
			
			if(x <= -8){
				output.x_low = true
			}
			if(x == -8){
				output.x_equal_low = true
			}
			if(y <= -8){
				output.y_low = true
			}
			if(y == -8){
				output.y_equal_low = true
			}
			if(z <= -8){
				output.z_low = true
			}
			if(z == -8){
				output.z_equal_low = true
			}
			if(x >= 8){
				output.x_high = true
			}
			if(x == 8){
				output.x_equal_high = true
			}
			if(y >= 8){
				output.y_high = true
			}
			if(y == 8){
				output.y_equal_high = true
			}
			if(z >= 8){
				output.z_high = true
			}
			if(z == 8){
				output.z_equal_high = true
			}
			
			position_info.push(output);
		}
		
		geometry.userData.position_info = position_info;
	}
	
	identify_group_sides(model){
		const geometry = model.geometry;
		const materials = model.material;
		const groups = geometry.groups;
		geometry.userData.groups = [];
		
		let is_indexed = false;
		if(geometry.index != null){
			is_indexed = true;
		}
		
		let index_map;
		if(is_indexed){
			index_map = geometry.index.array;
		}
		let position_map = geometry.userData.position_info;
		if(position_map == undefined){
			this.identify_points_sides(...arguments);
			return this.identify_group_sides(...arguments);
		}
		
		for(let g = 0; g < groups.length; g++){
			const group = groups[g];
			const number_of_positions_in_group = group.count;
			const material_index = group.materialIndex;
			const material = materials[material_index];
			
			const start_value = group.start;
			const count = {}
			
			for(let i = 0; i < number_of_positions_in_group; i++){
				let index = i + start_value;
				if(is_indexed){
					index = index_map[index]
				}
				
				const position_info = position_map[index];
				
				for(let key in position_info){
					if(count[key] == undefined){
						count[key] = 0;
					}
					
					const value = position_info[key];
					if(value){
						count[key]++;
					}
				}
			}
			
			group.sides = {};
			group.valid_sides = {};
			
			for(let key in count){
				group.sides[key] = false;
				if(count[key] == number_of_positions_in_group){
					group.sides[key] = true;
					if(this.base_sides[key] == true){
						group.valid_sides[key] = true;
					}
				}
			}
			
			group.area = this.calculate_area_of_group(geometry, g)
			group.transparency = material.transparent;
			group.material_uuid = material.uuid;
			
			geometry.userData.groups[g] = group;
		}
	}
	
	calculate_area_of_group(geometry, group = undefined){
		let is_indexed = false;
		if(geometry.index != null){
			is_indexed = true;
		}
		
		let index_map = [];
		if(is_indexed){
			index_map = geometry.index.array;
		}
		
		const vector1 = new THREE.Vector3()
		const vector2 = new THREE.Vector3()
		const vector3 = new THREE.Vector3()
		const triangle = new THREE.Triangle(vector1, vector2, vector3);
		
		const positions = geometry.getAttribute('position').array;
		
		const groups = geometry.groups;
		let start = 0;
		let finish = positions.length;
		
		if(group != undefined){
			start = groups[group].start * 3;
			finish = start + (groups[group].count * 3);
		}
		
		let area = 0;
		for(let i = start; i < finish; i += 9){
			let i3x1 = i + 0;
			let i3y1 = i + 1;
			let i3z1 = i + 2;
			let i3x2 = i + 3;
			let i3y2 = i + 4;
			let i3z2 = i + 5;
			let i3x3 = i + 6;
			let i3y3 = i + 7;
			let i3z3 = i + 8;
			
			if(is_indexed){
				i3x1 = index_map[i3x1];
				i3y1 = index_map[i3y1];
				i3z1 = index_map[i3z1];
				i3x2 = index_map[i3x2];
				i3y2 = index_map[i3y2];
				i3z2 = index_map[i3z2];
				i3x3 = index_map[i3x3];
				i3y3 = index_map[i3y3];
				i3z3 = index_map[i3z3];
			}
			
			const x1 = positions[i3x1]
			const y1 = positions[i3y1]
			const z1 = positions[i3z1]
			
			const x2 = positions[i3x2]
			const y2 = positions[i3y2]
			const z2 = positions[i3z2]
			
			const x3 = positions[i3x3]
			const y3 = positions[i3y3]
			const z3 = positions[i3z3]
			
			vector1.x = x1;
			vector1.y = y1;
			vector1.z = z1;
			
			vector2.x = x2;
			vector2.y = y2;
			vector2.z = z2;
			
			vector3.x = x3;
			vector3.y = y3;
			vector3.z = z3;
			
			const triangle_area = triangle.getArea();
			area += triangle_area;
		}
		
		return area
	}
	
	find_transparent_textures(materials){
		let promises = [];
		for(let i = 0; i < materials.length; i++){
			const material = materials[i];
			
			if(material.userData.transparency_checked == true){
				continue;
			}
			if(material.userData.transparency_promise == undefined){
				material.userData.transparency_promise = new Promise(
					async function(resolve, reject){
						if(material.map == null){
							return resolve(true)
						}
						const texture = material.map;
						
						if(texture.userData.hasLoaded != undefined){
							await texture.userData.hasLoaded;
						}
						
						const source = texture.source;
						let image_data;
						if(source.data instanceof ImageData){
							image_data = source.data;
						}else{
							let image = source.data;
							let bitmap = await createImageBitmap(image)
					
							let canvas;
							try{
								canvas = document.createElement("canvas");
							} catch(error){
								try{
									canvas = new OffscreenCanvas(1, 1);
								} catch(error){
									throw "Unable to create canvas"
								}
							}
					
							let context = canvas.getContext("2d");
							canvas.width = bitmap.width;
							canvas.height = bitmap.height;
							context.clearRect(0, 0, canvas.width, canvas.height);
							context.drawImage(bitmap, 0, 0);
					
							image_data = context.getImageData(0, 0, bitmap.width, bitmap.height);
						}
					
						let transparency = false;
						for(let i = 0; i < image_data.data.length; i += 4){
							let r = image_data.data[i + 0];
							let g = image_data.data[i + 1];
							let b = image_data.data[i + 2];
							let a = image_data.data[i + 3];
						
							if(a < 255){
								transparency = true;
								break;
							}
						}
						
						resolve(transparency)
					}
				).then(
					function(transparency){
						material.userData.transparency_checked = true;
						material.transparent = transparency;
						return transparency;
					}
				)
			}
			
			promises.push(material.userData.transparency_promise)
		}
		
		return Promise.all(promises);
	}
	
	is_solid_sides(model){
		const geometry = model.geometry;
				
		let side_names = [
			"x_equal_low",
			"x_equal_high",
			"y_equal_low",
			"y_equal_high",
			"z_equal_low",
			"z_equal_high"
		];
		let sides = {
			opaque: {},
			transparent: {}
		};
		for(let s = 0; s < side_names.length; s++){
			const name = side_names[s];
			sides.opaque[name] = 0
			sides.transparent[name] = 0
		}
		
		const groups = geometry.groups;
		let transparent_materials = {};
		for(let i = 0; i < groups.length; i++){
			const group = groups[i];
			const group_transparent = group.transparency;
			const material_index = group.materialIndex;
			const uuid = model.material[material_index].uuid;
			
			let prefix = "opaque";
			if(group_transparent){
				prefix = "transparent";
			}
			
			for(let s = 0; s < side_names.length; s++){
				const name = side_names[s];
				if(group.sides[name] == true){
					sides[prefix][name] += group.area;
					
					if(group_transparent){
						if(transparent_materials[name] == undefined){
							transparent_materials[name] = []
						}
						transparent_materials[name].push(uuid)
					}
				}
			}
		}
		
		let is_all_solid = true;
		geometry.userData.sides = { opaque: {}, transparent: {} }
		for(let s = 0; s < side_names.length; s++){
			const name = side_names[s];
			
			{
				let value = false;
				if(sides.opaque[name] >= (16 * 16)){
					value = true;
				}
			
				if(!value){
					is_all_solid = false;
				}
			
				geometry.userData.sides.opaque[name] = value;
			}
			{
				let value = false;
				if(sides.transparent[name] >= (16 * 16)){
					value = true;
				}
			
				geometry.userData.sides.transparent[name] = value;
			}
		}
		geometry.userData.sides.transparent_materials = transparent_materials;
		geometry.userData.is_full_block = is_all_solid;
	}
	
	
	get_point	=	function(positions, normals, uvs, start, i, index_map = undefined){
		let index = start + i;
				
		if(index_map != undefined){
			index = index_map[index]
		}
		let i3 = index * 3;
		let i2 = index * 2;
				
		let position = new GeometryPointArray(3);
		let normal = new GeometryPointArray(3);
		let uv = new GeometryPointArray(2);
				
		position.x = positions[i3 + 0]
		position.y = positions[i3 + 1]
		position.z = positions[i3 + 2]

		normal.x = normals[i3 + 0]
		normal.y = normals[i3 + 1]
		normal.z = normals[i3 + 2]
				
		uv.u = uvs[i2 + 0]
		uv.v = uvs[i2 + 1]
				
				
		return {
			position: position,
			uv: uv,
			normal: normal,
			index: i
		}
	}
	
	compare_vectors(position_a1, position_a2, position_b1, position_b2){
		let	x_gap_a = position_a2.position.x - position_a1.position.x;
		let	y_gap_a = position_a2.position.y - position_a1.position.y;
		let	z_gap_a = position_a2.position.z - position_a1.position.z;
		
		
		let	x_gap_b = position_b2.position.x - position_b1.position.x;
		let	y_gap_b = position_b2.position.y - position_b1.position.y;
		let	z_gap_b = position_b2.position.z - position_b1.position.z;
		
		let output = {
			x: undefined,
			y: undefined,
			z: undefined,
			valid: false
		}
		
		let count = 0;
		
		if(x_gap_a == x_gap_b){
			output.x = x_gap_a;
			count++;
		}
		if(y_gap_a == y_gap_b){
			output.y = y_gap_a;
			count++;
		}
		if(z_gap_a == z_gap_b){
			output.z = z_gap_a;
			count++;
		}
		
		if(count == 3){
			output.valid = true;
		}
		
		return output;
	}
	
	is_rectangle_groups(model){
		const geometry = model.geometry;
		const positions = geometry.getAttribute('position').array;
		const normals = geometry.getAttribute('normal').array;
		const uvs = geometry.getAttribute('uv').array;
		
		let is_indexed = false;
		if(geometry.index != null){
			is_indexed = true;
		}
		
		let index_map;
		if(is_indexed){
			index_map = geometry.index.array;
		}
		
		const groups = geometry.groups;
		for(let g = 0; g < groups.length; g++){
			const group = groups[g];
			group.is_rectangle = false;
			
			const count = group.count;
			const start = group.start;
			
			
			if(count != 6){
				continue;
			}
			
			let top_left;
			let top_right;
			let bottom_left;
			let bottom_right;
			let all_valid = true;
			
			let order = new Array(count);
			
			let normal;
			
			for(let i = 0; i < count; i++){
				let point = this.get_point(positions, normals, uvs, start, i, index_map);
				let valid = false;
				if(point.uv.u == 0){
					if(point.uv.v == 0){
						top_left = point;
						order[i] = 0
						valid = true;
					}
					if(point.uv.v == 1){
						bottom_left = point;
						order[i] = 1
						valid = true;
					}
				}
				if(point.uv.u == 1){
					if(point.uv.v == 0){
						top_right = point;
						order[i] = 2
						valid = true;
					}
					if(point.uv.v == 1){
						bottom_right = point;
						order[i] = 3
						valid = true;
					}
				}
				
				if(normal == undefined){
					normal = point.normal.array.join(",")
				}
				
				if(!valid){
					all_valid = false;
				}
			}
			
			if(!all_valid){
				continue;
			}
			
			if(top_left == undefined || top_right == undefined || bottom_left == undefined || bottom_right == undefined){
				continue;
			}
			
			// Check to see if the vectors between the points are the same
			let top_vs_bottom = this.compare_vectors(top_left, top_right, bottom_left, bottom_right)
			let left_vs_right = this.compare_vectors(top_left, bottom_left, top_right, bottom_right)
			
			if(top_vs_bottom.valid != true || left_vs_right.valid != true){
				continue;
			}
			
			
			
			group.points = {
				top_left: top_left.index,
				top_right: top_right.index,
				bottom_left: bottom_left.index,
				bottom_right: bottom_right.index
			}
			group.point_order = order;
			group.normal = normal;
			group.is_rectangle = true;
		}
	}
	
	async get_model_no_cache(model_name, options){
		const block_loader = this.block_loader;
		const model_cleaner = this.model_cleaner;
		
		try{
			const model_data = await block_loader.get_model_data(model_name, "");
			
			const model = await block_loader.get_model(model_data, options, 0);
		
			const clean_model = await model_cleaner.clean_model(model);
			
			
			await this.find_transparent_textures(clean_model.material);
			
			this.identify_group_sides(clean_model);
		
			this.is_solid_sides(clean_model);
			
			const geometry = clean_model.geometry;
			geometry.scale(1 / 16, 1 / 16, 1 / 16);
			
			this.is_rectangle_groups(clean_model);
			
			geometry.userData.is_valid = true;
			clean_model.name = model_name;
			options.model = model_name;
			clean_model.userData = options;
			
			const remapped_model = await this.remap_model(clean_model);
			
			return remapped_model;
		} catch(error){
			console.error("Error encountered on:", model_name, options, error)
			let mesh = new THREE.Mesh()
			mesh.userData = options;
			mesh.name = model_name;
			mesh.geometry.userData.is_valid = false;
			console.log(mesh)
			return mesh;
		}
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
