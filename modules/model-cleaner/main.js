import { THREE, BufferGeometryUtils } from "/packaged/node-modules.js";

class SplitGeometry {
	constructor(buffer_geometry, material){
		this.geometry = buffer_geometry;
		this.material = material;
	}
	
	get buffer_geometry(){
		return this.geometry;
	}

	get uuid(){
		return this.material.uuid;
	}
}

class ModelCleaner {
	/**
	 * Takes a THREE.Object3D (such as a BlockModelObject) and converts it into a Mesh with a single (grouped) buffer geometry and a materials list
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
		
		
		// Split into groups, paired with their material
		const groups = meshes.map(mesh => this.separate_groups(mesh)).flat(Infinity)
		
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
		
		const output_buffer_geometries = [];
		const output_materials = [];
		
		// Merge geometries
		for(const uuid in sorted){
			const groups = sorted[uuid];
			const material = groups[0].material;
			
			const buffer_geometries = groups.map(group => group.geometry)
			
			const buffer_geometry = this.merge_buffer_geometries(buffer_geometries, false);
			output_buffer_geometries.push(buffer_geometry)
			output_materials.push(material);
		}
		
		if(output_buffer_geometries.length ==0){
			return new THREE.Mesh()
		}
		
		const output_geometry = this.merge_buffer_geometries(output_buffer_geometries, true);
		
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
		let geometry = mesh.geometry;
		const materials = mesh.material || [];
		if(geometry.index != null){
			geometry = geometry.toNonIndexed();
		}
		
		let output = [];

		const groups = geometry.groups;
		
		const original_positions = geometry.getAttribute('position').array;
		const original_normals = geometry.getAttribute('normal').array;
		const original_uvs = geometry.getAttribute('uv').array;

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

			output.push(new SplitGeometry(buffer_geometry, material));
		}
		

		return output;
	}
}

export { ModelCleaner }
