import { THREE, CSG, CSGNode, BufferGeometryUtils } from "/packaged/node-modules.js"
import { GeometryPointArray } from "../geometry_point_array/main.js";

class GreedyMesher {
	constructor(){
	}
	
	extract_meshes(model){
		let output = [];
		let children = model.children || [];
		for(let i = 0; i < children.length; i++){
			const child = children[i];
			output.push(...this.extract_meshes(child));
		}
		if(model.isMesh){
			output.push(model)
		}
		
		return output;
	}
	
	get_point(group, point_number, positions, normals, uvs){
		const index = group.start + point_number;
		const i2 = index * 2;
		const i3 = index * 3;
				
		const position = new GeometryPointArray(3);
		const normal = new GeometryPointArray(3);
		const uv = new GeometryPointArray(2);
		
		if(positions != undefined){
			position.x = positions[i3 + 0]
			position.y = positions[i3 + 1]
			position.z = positions[i3 + 2]
		}
		if(normals != undefined){
			normal.x = normals[i3 + 0]
			normal.y = normals[i3 + 1]
			normal.z = normals[i3 + 2]
		}
		if(uvs != undefined){
			uv.u = uvs[i2 + 0]
			uv.v = uvs[i2 + 1]
		}
		
		return {
			position: position,
			normal: normal,
			uv: uv
		}
	}
	
	points_equal(position_1, position_2){
		if(position_1.x == position_2.x && position_1.y == position_2.y && position_1.z == position_2.z){
			return true;
		}
		return false;
	}
	
	try_to_merge_faces(base_face, faces, horizontal = false, vertical = false){
		const base_top_right = base_face.points.top_right;
		const base_bottom_left = base_face.points.bottom_left;
		const base_bottom_right = base_face.points.bottom_right;
		
		const new_faces = [];
		
		for(let i = 0; i < faces.length; i++){
			const face = faces[i];
			let did_merge_faces = false;
			
			if(face.index == base_face.index){
				new_faces.push(face);
				continue;
			}
			
			const top_left = face.points.top_left;
			
			if(horizontal){
				if(this.points_equal(top_left.position, base_top_right.position)){
					const bottom_left = face.points.bottom_left;
					if(this.points_equal(bottom_left.position, base_bottom_right.position)){
						const top_right = face.points.top_right;
						const bottom_right = face.points.bottom_right;
								
						const addition = bottom_right.uv.u;
								
						base_top_right.uv.u += addition;
						base_bottom_right.uv.u += addition;
						base_top_right.position = top_right.position;
						base_bottom_right.position = bottom_right.position;
						
						did_merge_faces = true;
					}
				}
			}
			if(vertical){
				if(this.points_equal(top_left.position, base_bottom_left.position)){
					const top_right = face.points.top_right;
					if(this.points_equal(top_right.position, base_bottom_right.position)){
						const bottom_left = face.points.bottom_left;
						const bottom_right = face.points.bottom_right;
								
						const addition = bottom_right.uv.v;
								
						base_bottom_left.uv.v += addition;
						base_bottom_right.uv.v += addition;
						base_bottom_left.position = bottom_left.position;
						base_bottom_right.position = bottom_right.position;
						
						did_merge_faces = true;
					}
				}
			}
			
			if(!did_merge_faces){
				new_faces.push(face);
			}
		}
		
		return new_faces;
	}
	
	greedy_mesh_faces(faces){
		for(let i = 0; i < faces.length; i++){
			const face = faces[i];
			
			while(true){
				const base_length = faces.length;
				faces = this.try_to_merge_faces(face, faces, true, false);
				if(base_length == faces.length){
					break;
				}
			}
		}
		
		for(let i = 0; i < faces.length; i++){
			const face = faces[i];
			
			while(true){
				const base_length = faces.length;
				faces = this.try_to_merge_faces(face, faces, false, true);
				if(base_length == faces.length){
					break;
				}
			}
		}
		
		return faces;
	}
	
	separate_group(geometry, group_number, original_positions, original_normals, original_uvs){
		const groups = geometry.groups;

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
	
	construct_rectangle_geometry(face, point_order){
		const buffer_geometry = new THREE.BufferGeometry();
		
		const point_map = [
			face.points.top_left,
			face.points.bottom_left,
			face.points.top_right,
			face.points.bottom_right
		]
		
		const points = point_order.map(index => point_map[index]);
		
		const positions = new Float32Array(points.length * 3);
		const normals = new Float32Array(points.length * 3);
		const uvs = new Float32Array(points.length * 2);
		
		for(let i = 0; i < points.length; i++){
			const point = points[i];
			positions.set(point.position.array, i * 3);
			normals.set(point.normal.array, i * 3);
			uvs.set(point.uv.array, i * 2);
		}
		
		buffer_geometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
		buffer_geometry.setAttribute('normal', new THREE.Float32BufferAttribute(normals, 3));
		buffer_geometry.setAttribute('uv', new THREE.Float32BufferAttribute(uvs, 2));
		
		
		return buffer_geometry;
	}
	
	reconstruct_geometry(groups){
		const data = [];
		const geometries = [];
		
		for(let i = 0; i < groups.length; i++){
			const group = groups[i];
			
			data.push(group.data);
			
			if(group.is_rectangle == false){
				geometries.push(group.buffer_geometry);
				continue;
			}
			
			const geometry = this.construct_rectangle_geometry(group, group.data.point_order);
			geometries.push(geometry);
		}
		
		const merged_geometry = BufferGeometryUtils.mergeBufferGeometries(geometries, true);
		for(let i = 0; i < merged_geometry.groups.length; i++){
			const group = merged_geometry.groups[i];
			group.materialIndex = data[i].materialIndex;
			geometries[i].dispose();
		}
		
		merged_geometry.userData = {}
		
		return merged_geometry;
	}
	
	greedy_mesh_geometry(geometry){
		const groups = geometry.groups;
		const group_data = geometry.userData.groups;
		
		const positions = geometry.getAttribute('position').array;
		const normals = geometry.getAttribute('normal').array;
		const uvs = geometry.getAttribute('uv').array;
		
		let valid_groups = {};
		let output_groups = [];
		for(let i = 0; i < groups.length; i++){
			const group = groups[i];
			const data = group_data[i];
			const parent_data = data.parent;
			
			if(parent_data.is_rectangle != true){
				output_groups.push({
					index: i,
					group: group,
					data: parent_data,
					is_rectangle: false,
					buffer_geometry: this.separate_group(geometry, i, positions, normals, uvs)
				})
				continue;
			}
			
			const normal = parent_data.normal;
			const material_index = parent_data.materialIndex;
			
			const top_left = this.get_point(group, parent_data.points.top_left, positions, normals, uvs)
			const top_right = this.get_point(group, parent_data.points.top_right, positions, normals, uvs)
			const bottom_left = this.get_point(group, parent_data.points.bottom_left, positions, normals, uvs)
			const bottom_right = this.get_point(group, parent_data.points.bottom_right, positions, normals, uvs)
			
			if(valid_groups[material_index] == undefined){
				valid_groups[material_index] = {};
			}
			if(valid_groups[material_index][normal] == undefined){
				valid_groups[material_index][normal] = [];
			}
			
			valid_groups[material_index][normal].push({
				index: i,
				group: group,
				data: parent_data,
				points: {
					top_left: top_left,
					top_right: top_right,
					bottom_left: bottom_left,
					bottom_right: bottom_right
				},
				is_rectangle: true
			})
		}
		
		for(let material in valid_groups){
			for(let normal in valid_groups[material]){
				const re_meshed_group = 	this.greedy_mesh_faces(valid_groups[material][normal]);
				output_groups.push(...re_meshed_group);
			}
		}
		
		const new_geometry = this.reconstruct_geometry(output_groups);
		
		return new_geometry;
	}
	
	remesh(chunk_model){
		let meshes = this.extract_meshes(chunk_model);
		for(let i = 0; i < meshes.length; i++){
			const mesh = meshes[i];
			let new_geometry = this.greedy_mesh_geometry(mesh.geometry);
			new_geometry = BufferGeometryUtils.mergeGroups(new_geometry)
			
			mesh.geometry = new_geometry;
		}
		
		return chunk_model;
	}
}

export { GreedyMesher }
