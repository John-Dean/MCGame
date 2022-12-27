import { THREE, BufferGeometryUtils, CSG, Earcut } from "/packaged/node-modules.js";
import { SimplifyModifier } from "./SimplifyModifier.js"

class SplitGeometry {
	constructor(buffer_geometry, material, index){
		this.geometry = buffer_geometry;
		this.material = material;
		this.index = index;
	}

	get buffer_geometry(){
		return this.geometry;
	}

	get uuid(){
		return this.material.uuid;
	}
}

function log_positions(geometry, group_number){
	const original_positions = geometry.getAttribute('position').array;
	let group = geometry.groups[group_number];
	
	let start = group.start;
	let count = group.count;
	
	let output = [];
	for(let i = start; i < count * 3; i += 3){
		let x = original_positions[i + 0];
		let y = original_positions[i + 1];
		let z = original_positions[i + 2];
		
		output.push({
			x: x,
			y: y,
			z: z
		})
	}
	
	console.log(output);
}


class ModelCleaner {
	merge_meshes(meshes){
		// Split into groups, paired with their material - each group is a face
		let groups = [];
		for(let i = 0; i < meshes.length; i++){
			const mesh = meshes[i];
			const split_groups = this.separate_groups(mesh);
			for(let n = 0; n < split_groups.length; n++){
				split_groups[n].index = i;
			}
			groups.push(...split_groups)
		}
		
		// Group by material unique identifier
		const sorted = {};
		for(let i = 0; i < groups.length; i++){
			const group = groups[i];
			const uuid = group.uuid;
			if(sorted[uuid] == undefined){
				sorted[uuid] = [];
			}
			sorted[uuid].push(group);
		}
		
		let material_map = {};
		let material_counter = 0;
		for(const uuid in sorted){
			material_map[uuid] = material_counter;
			material_counter++;
		}
		
		let materials = [];
		
		// Reassemble original geometries
		let mesh_parts = [];
		for(let i = 0; i < groups.length; i++){
			const group = groups[i];
			const index = group.index;
			if(mesh_parts[index] == undefined){
				mesh_parts[index] = [];
			}
			mesh_parts[index].push(group);
		}
		
		let group_mapping = [];
		let all_geometries = [];
		for(let i = 0; i < mesh_parts.length; i++){
			const split_geometries = mesh_parts[i];
			let geometries = split_geometries.map(split_geometry => split_geometry.geometry);
			
			let merged_geometry = BufferGeometryUtils.mergeBufferGeometries(geometries, true);
			
			let materials_indexes = split_geometries.map(split_geometry => {
				let material = split_geometry.material;
				let uuid = material.uuid;
				let index = material_map[uuid];
				if(materials[index] == undefined){
					materials[index] = material;
				}
				return index;
			});
			
			
			const groups = merged_geometry.groups;
			for(let g = 0; g < groups.length; g++){
				const group = groups[g];
				group.materialIndex = group_mapping.length;
				const index = group.materialIndex;
				group_mapping[index] = materials_indexes[g];
			}
			
			all_geometries.push(merged_geometry)
		}
		console.log(all_geometries, group_mapping)
		
		const csgs = all_geometries.map(geometry => CSG.fromGeometry(geometry))
		console.log(csgs)
		
		let base_csg = csgs[0];
		console.log()
		for(let i = 0; i < csgs.length; i++){
			base_csg = base_csg.union(csgs[i]);
		}
		
		let merged_geometry = base_csg.toGeometry(new THREE.Matrix4().identity())
		for(let i = 0; i < merged_geometry.groups.length; i++){
			const group = merged_geometry.groups[i]
			group.materialIndex = group_mapping[group.materialIndex];
		}
		
		
		// materials = new THREE.MeshBasicMaterial({
		// 	color: 0xff0000,
		// 	wireframe: true
		// });
		
		
		const mesh = new THREE.Mesh(merged_geometry, materials);
		
		
		return mesh;
	}
	
	calculate_area(geometry){
		let is_indexed = false;
		if(geometry.index != null){
			is_indexed = true;
		}
		
		if(is_indexed){
			geometry = geometry.toNonIndexed();
		}
		
		let vector1 = new THREE.Vector3()
		let vector2 = new THREE.Vector3()
		let vector3 = new THREE.Vector3()
		let triangle = new THREE.Triangle(vector1, vector2, vector3);
		
		const positions = geometry.getAttribute('position').array;
		
		let area = 0;
		for(let i = 0; i < positions.length; i += 9){
			let x1 = positions[i + 0]
			let y1 = positions[i + 1]
			let z1 = positions[i + 2]
			
			let x2 = positions[i + 3]
			let y2 = positions[i + 4]
			let z2 = positions[i + 5]
			
			let x3 = positions[i + 6]
			let y3 = positions[i + 7]
			let z3 = positions[i + 8]
			
			vector1.x = x1;
			vector1.y = y1;
			vector1.z = z1;
			
			vector2.x = x2;
			vector2.y = y2;
			vector2.z = z2;
			
			vector3.x = x3;
			vector3.y = y3;
			vector3.z = z3;
			
			let triangle_area = triangle.getArea();
			area += triangle_area;
		}
		
		return area
	}
	
	reassign_normals_and_uvs(old_geometry, new_geometry){
		const old_positions = old_geometry.getAttribute('position').array;
		const old_normals = old_geometry.getAttribute('normal').array;
		const old_uvs = old_geometry.getAttribute('uv').array;
		
		const new_positions = new_geometry.getAttribute('position').array;
		
		let new_normals = [];
		let new_uvs = [];
		for(let i = 0; i < new_positions.length; i += 3){
			let x_new = new_positions[i + 0]
			let y_new = new_positions[i + 1]
			let z_new = new_positions[i + 2]
			
			for(let n = 0; n < old_positions.length; n += 3){
				let x_old = old_positions[n + 0]
				let y_old = old_positions[n + 1]
				let z_old = old_positions[n + 2]
				
				if(x_new == x_old && y_new == y_old && z_new == z_old){
					let normal_x = 	old_normals[n + 0];
					let normal_y = 	old_normals[n + 1];
					let normal_z = 	old_normals[n + 2];
					let uv_x = 	old_uvs[((n / 3) * 2) + 0];
					let uv_y = 	old_uvs[((n / 3) * 2) + 1];
					
					new_normals.push(...[normal_x, normal_y, normal_z])
					new_uvs.push(...[uv_x, uv_y])
					break;
				}
			}
		}
		
		new_geometry.setAttribute('normal', new THREE.Float32BufferAttribute(new_normals, 3));
		new_geometry.setAttribute('uv', new THREE.Float32BufferAttribute(new_uvs, 2));
		
		return new_geometry;
	}
	
	geometry_to_points(geometry){
		const positions = geometry.getAttribute('position').array;
		const normals = geometry.getAttribute('normal').array;
		const uvs = geometry.getAttribute('uv').array;
		let points = [];
		
		for(let i = 0; i < positions.length; i += 3){
			let point = {};
			point.position = [
				positions[i + 0],
				positions[i + 1],
				positions[i + 2]
			]
			point.normal = [
				normals[i + 0],
				normals[i + 1],
				normals[i + 2]
			]
			point.uv = [
				uvs[((i / 3) * 2) + 0],
				uvs[((i / 3) * 2) + 1]
			]
			point.relations = {};
			point.polygons = [];
			
			points.push(point);
		}
		
		return points;
	}
	
	find_loops(points, indexes){
		for(let i = 0; i < indexes.length; i += 3){
			let i0 = indexes[i + 0]
			let i1 = indexes[i + 1]
			let i2 = indexes[i + 2]
			
			points[i0].polygons.push([i0, i1, i2]);
			
			points[i0].relations[i1] = true;
			points[i0].relations[i2] = true;
			
			points[i1].relations[i0] = true;
			points[i1].relations[i2] = true;
			
			points[i2].relations[i0] = true;
			points[i2].relations[i1] = true;
		}
		
		let loops = [];
		const add_to_loop = function(points, i){
			const point = points[i];
			for(let n in point.relations){
				point.loop[n] = true;
				if(points[n].loop == undefined){
					points[n].loop = point.loop;
					add_to_loop(points, n)
				}
			}
		}
		
		for(let i in points){
			const point = points[i];
			if(point.loop == undefined){
				point.loop = {};
				loops.push(point.loop);
				point.loop[i] = true;
				add_to_loop(points, i);
			}
		}
		
		return loops;
	}
	
	split_loops(raw_geometry){
		let geometry = BufferGeometryUtils.mergeVertices(raw_geometry);
		
		let points = this.geometry_to_points(geometry);
		
		let indexes = geometry.index.array;

		let loops = this.find_loops(points, indexes);
		
		let geometries = [];
		for(let i = 0; i < loops.length; i++){
			const loop = loops[i];
			let positions = [];
			let normals = [];
			let uvs = [];
			for(let index in loop){
				let point = points[index];
				let polygons = point.polygons;
				for(let p = 0; p < polygons.length; p++){
					const polygon = polygons[p];
					for(let n = 0; n < polygon.length; n++){
						const polygon_point = points[polygon[n]];
						positions.push(...polygon_point.position)
						normals.push(...polygon_point.normal)
						uvs.push(...polygon_point.uv)
					}
				}
			}
			
			const buffer_geometry = new THREE.BufferGeometry();
			buffer_geometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
			buffer_geometry.setAttribute('normal', new THREE.Float32BufferAttribute(normals, 3));
			buffer_geometry.setAttribute('uv', new THREE.Float32BufferAttribute(uvs, 2));
			geometries.push(buffer_geometry)
		}
		
		return geometries;
	}
	
	separate_faces(mesh){
		let raw_split_groups = this.separate_groups(mesh);
		let split_groups = [];
		for(let i = 0; i < raw_split_groups.length; i++){
			const split_group = raw_split_groups[i];
			const split_loops = this.split_loops(split_group.geometry);
			if(split_loops.length == 0){
				continue;
			}
			const merged_loops = this.merge_buffer_geometries(split_loops, true);
			for(let i = 0; i < merged_loops.groups.length; i++){
				merged_loops.groups[i].materialIndex = 0;
			}
			
			const loop_mesh = new THREE.Mesh(merged_loops, split_group.material);
			const new_split_group = this.separate_groups(loop_mesh);
			
			split_groups.push(...new_split_group)
		}
		return split_groups;
	}
	
	
	merge_polygons(mesh){
		const simplifier = new SimplifyModifier();
		
		let split_groups = this.separate_faces(mesh);
		
		console.log(split_groups.map(g => g.geometry.attributes.position.count))
		
		let new_groups = [];
		for(let g = 6; g < 8; g++){
			const split_group = split_groups[g];

			const raw_geometry = split_group.geometry;
			let geometry = BufferGeometryUtils.mergeVertices(raw_geometry);
			
			const base_count = geometry.attributes.position.count
			if(base_count == 0){
				continue;
			}
			const base_area = this.calculate_area(geometry);
			// console.log(base_count)
			
			let reduction_count = 0;
			let new_geometry = geometry;
			while(reduction_count < base_count){
				reduction_count++;
				let simplified_geometry = simplifier.modify(geometry, reduction_count)
				let new_area = this.calculate_area(simplified_geometry);
				if(new_area == base_area){
					new_geometry = simplified_geometry;
				}
				// console.log(reduction_count, new_area, base_area)
			}
			
			let new_count = new_geometry.attributes.position.count;
			console.log(`${base_count} => ${new_count}`)
			
			if(new_geometry != geometry){
				this.reassign_normals_and_uvs(geometry, new_geometry);
			}
			
			new_geometry = this.optimize_geometry(new_geometry)
			new_geometry = new_geometry.toNonIndexed();
			
			
			this.split_loops(new_geometry);
			
			split_group.geometry = new_geometry;
			new_groups.push(split_group)
		}
		console.log(new_groups.map(g => g.geometry.attributes.position.count))
		
		let output_mesh = this.merge_groups(new_groups);
		return output_mesh;
		
		console.log(new_groups)
		
		
		console.log(simplifier)
	}
	
	
	/**
	 * Takes a THREE.Object3D (such as a BlockModelObject) and converts it into a Mesh
	 * featuring a single buffer geometry (with groups for each face) and a materials list
	 * Each group has 6 positions, in the format a c b c d a
	 *
	 * @param   {THREE.Object3D}  model
	 * @param   {Number}          [round_value] The value to the BufferGeometry values to
	 *
	 *
	 * @return  {THREE.Mesh}
	 */
	clean_model(model, round_value = 1 / 32){
		// Pull all the meshes
		const meshes = this.extract_meshes(model);
		
		const merged_mesh = this.merge_meshes(meshes);
		
		const merge_poly_mesh = this.merge_polygons(merged_mesh);
		
		
		let output = merge_poly_mesh;
		output.material = new THREE.MeshBasicMaterial({
			color: 0xff0000,
			wireframe: true
		});
			
		return output;
		// const csgs = meshes.map(mesh => CSG.fromGeometry(mesh.geometry))
		// console.log(csgs)
		
		// let base_csg = csgs[0];
		// for(let i=0;i<csgs.length;i++){
		// 	base_csg = base_csg.union(csgs[i]);
		// }
		
		// const merged_meshes = base_csg.toGeometry(new THREE.Matrix4().identity())
		
		// console.log(merged_meshes)
		
		let sorted = {};
		
		const output_buffer_geometries = [];
		const buffer_geometries_material_number = [];
		const output_materials = [];

		// Merge geometries
		for(const uuid in sorted){
			const groups = sorted[uuid];
			const material = groups[0].material;
			
			const material_index = output_materials.length;
			output_materials[material_index] = material;

			const buffer_geometries = groups.map(group => group.geometry)
			for(let i = 0; i < buffer_geometries.length; i++){
				const buffer_geometry = buffer_geometries[i];
				output_buffer_geometries.push(buffer_geometry);
				buffer_geometries_material_number.push(material_index);
			}
		}
		
		
		if(output_buffer_geometries.length == 0){
			return new THREE.Mesh()
		}

		const output_geometry = this.merge_buffer_geometries(output_buffer_geometries, true);
		for(let i = 0; i < output_geometry.groups.length; i++){
			const group = output_geometry.groups[i];
			group.materialIndex = buffer_geometries_material_number[i];
		}
		
		console.log(output_materials)
		
		const output_mesh = new THREE.Mesh(output_geometry, output_materials)

		if(round_value != undefined){
			this.clean_geometry(output_geometry, round_value)
		}

		return output_mesh;
	}

	/**
	 * Takes a list of models and merges them together into a single mesh
	 *
	 * @param   {THREE.Object3D[]}  model_list
	 * @param   {Number}            [round_value] The value to the BufferGeometry values to
	 *
	 * @return  {THREE.Mesh}
	 */
	merge_models(model_list, round_value){
		if(model_list.length == 1){
			return model_list[0]
		}

		const group = new THREE.Group();
		group.add(...model_list)

		return this.clean_model(group, round_value)
	}

	/**
	 * Loops through a buffer geometry's attributes and rounds them as they frequently get slightly out
	 *
	 * @param   {THREE.BufferGeometry}  buffer_geometry
	 * @param   {Number}                [multiply]         The amount to multiply each value by when rounding
	 */
	clean_geometry(buffer_geometry, multiply = 1 / 32){
		for(let attribute in buffer_geometry.attributes){
			let array = buffer_geometry.getAttribute(attribute).array;
			for(let i = 0; i < array.length; i++){
				array[i] = Math.round(array[i] / multiply) * multiply;
			}
		}
	}

	/**
	 * Takes a provided model and flattens it down to its meshes
	 *
	 * @param   {BlockModelObject}  model  The block model to flatten
	 *
	 * @return  {THREE.Mesh[]}             Array of flattened meshes
	 */
	extract_meshes(model){
		// Update the matrix's position in the world, this is so we can bake it into the geometry
		model.updateMatrixWorld();

		const output = [];
		const children = model.children || [];
		if(children.length > 0){
			// If the item has children, we loop through them and recursively run this function
			for(let i = 0; i < children.length; i++){
				const child = children[i];

				const flattened_models = this.extract_meshes(child)

				output.push(...flattened_models)
			}
		} else if(model.isMesh){
			// If the model is a mesh, then we can bake the matrix world into it
			const geometry = model.geometry;
			const matrix_world = model.matrixWorld;

			geometry.applyMatrix4(matrix_world);

			output.push(model);
		}

		// Finally we reset the position of the object, as this has just been baked in
		model.position.set(0, 0, 0);
		model.rotation.set(0, 0, 0);
		model.scale.set(1, 1, 1);
		model.updateMatrix();

		return output;
	}

	/**
	 * Merges a flattened model into a single geometry
	 *
	 * @param   {THREE.BufferGeometry[]}  buffer_geometries
	 * @param   {Boolean}                 use_groups        Whether to merge each item into a new group
	 *
	 * @return  {THREE.BufferGeometry}
	 */
	merge_buffer_geometries(buffer_geometries, use_groups = false){
		const merged_geometry = BufferGeometryUtils.mergeBufferGeometries(buffer_geometries, use_groups);
		merged_geometry.userData = {}
		return merged_geometry;
	}

	/**
	 * Splits a buffer geometry into several buffer geometries based on the groups
	 *
	 * @param   {THREE.BufferGeometry}  buffer_geometry
	 *
	 * @return  {SplitGeometry[]}
	 *
	 * Adapted from code made by "yombo"
	 * {@link https://discourse.threejs.org/t/buffergeometry-groups-to-individual-buffergeometries/12812/2}
	 */
	separate_groups(mesh){
		let output = [];

		const geometry = mesh.geometry;
		
		let is_indexed = false;
		if(geometry.index != null){
			is_indexed = true;
		}
		
		let materials = mesh.material || [];
		if(!(materials instanceof Array)){
			materials = [materials]
		}
		const groups = geometry.groups;
		const original_positions = geometry.getAttribute('position').array;
		const original_normals = geometry.getAttribute('normal').array;
		const original_uvs = geometry.getAttribute('uv').array;
		let index_map;
		if(is_indexed){
			index_map = geometry.index.array;
		}
		for(let g = 0; g < groups.length; g++){
			const group = groups[g];
			const material_index = group.materialIndex;
			const material = materials[material_index];
			if(typeof material === "object"){
				if(material.uuid == undefined){
					continue;
				}
			} else {
				continue;
			}
			const number_of_positions_in_group = group.count;
			const start_value = group.start;

			const buffer_geometry = new THREE.BufferGeometry();
			const positions = new Float32Array(number_of_positions_in_group * 3);
			const normals = new Float32Array(number_of_positions_in_group * 3);
			const uvs = new Float32Array(number_of_positions_in_group * 2);

			for(let i = 0; i < number_of_positions_in_group; i++){
				let index = i + start_value;
				if(is_indexed){
					index = index_map[index]
				}
				
				const i3_original = 3 * index;
				const i3_new = 3 * i;
				
				const i2_original = 2 * index;
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

			output.push(new SplitGeometry(buffer_geometry, material));
		}
		
		return output;
	}
	
	merge_groups(split_groups){
		let material_index = {};
		let materials = [];
		
		let geometries = [];
		let indexes = [];
		for(let i = 0; i < split_groups.length; i++){
			const group = split_groups[i];
			const geometry = group.geometry;
			const material = group.material;
			const uuid = group.uuid;
			
			if(material_index[uuid] == undefined){
				material_index[uuid] = materials.length;
				materials.push(material);
			}
			
			const index = material_index[uuid];
			
			geometries.push(geometry)
			indexes.push(index);
		}
		
		console.log(geometries)
		
		let merged_geometry = this.merge_buffer_geometries(geometries, true);
		for(let i = 0; i < merged_geometry.groups.length; i++){
			merged_geometry.groups[i].materialIndex = indexes[i];
		}
		
		let mesh = new THREE.Mesh(merged_geometry, materials);
		return mesh;
	}
}

export { ModelCleaner }
