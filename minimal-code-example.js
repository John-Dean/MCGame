import { THREE, OrbitControls } from "/packaged/node-modules.js"

import { MapLoader } from "./modules/map-loader/main.js";



const scene = new THREE.Scene();
const width = window.innerWidth;
const height = window.innerHeight;


// const camera = new THREE.PerspectiveCamera(75, width / height, 0.1, 1000);
const camera = new THREE.OrthographicCamera(width / -2, width / 2, height / 2, height / -2, 1, 1000);

let canvas = document.createElement("canvas")
let context = canvas.getContext('webgl2');
const renderer = new THREE.WebGLRenderer({
	antialias: true,
	canvas: canvas,
	context: context
});
renderer.shadowMap.enabled = true;

renderer.setSize(window.innerWidth, window.innerHeight);
document.body.appendChild(renderer.domElement);

const gl = renderer.domElement.getContext('webgl2');
if(!gl){
	throw "WebGL 2 not available";
}

camera.position.x = 200
camera.position.y = 200
camera.position.z = 200
camera.rotation.x = -1.5

camera.zoom = 20
camera.updateProjectionMatrix();
const controls = new OrbitControls(camera, renderer.domElement)


const ambient_light = new THREE.AmbientLight(0x404040, 4); // soft white light
scene.add(ambient_light);


let map_loader = new MapLoader();
await map_loader.add_resource_pack("/assets/resource-pack/")
let model = await map_loader.get_block_from_blockstate("block/magenta_glazed_terracotta", { facing: "north" });

scene.add(model)

{
	{
		let model = await map_loader.get_block_from_blockstate("block/acacia_stairs", { facing: "north", half: "top", shape: "straight" });
		model.position.x = 0;
		model.position.z = 1;
		scene.add(model)
	}
	{
		let model = await map_loader.get_block_from_blockstate("block/acacia_stairs", { facing: "north", half: "top", shape: "outer_left" });
		model.position.x = 1;
		model.position.z = 1;
		scene.add(model)
	}
	{
		let model = await map_loader.get_block_from_blockstate("block/acacia_stairs", { facing: "north", half: "top", shape: "outer_right" });
		model.position.x = -1;
		model.position.z = 1;
		scene.add(model)
	}
	{
		let model = await map_loader.get_block_from_blockstate("block/acacia_stairs", { facing: "east", half: "top", shape: "straight" });
		model.position.x = -1;
		model.position.z = 0;
		scene.add(model)
	}
	{
		let model = await map_loader.get_block_from_blockstate("block/acacia_stairs", { facing: "east", half: "top", shape: "outer_right" });
		model.position.x = -1;
		model.position.z = -1;
		scene.add(model)
	}
	{
		let model = await map_loader.get_block_from_blockstate("block/acacia_stairs", { facing: "west", half: "top", shape: "straight" });
		model.position.x = 1;
		model.position.z = 0;
		scene.add(model)
	}
	{
		let model = await map_loader.get_block_from_blockstate("block/acacia_stairs", { facing: "west", half: "top", shape: "outer_left" });
		model.position.x = 1;
		model.position.z = -1;
		scene.add(model)
	}
	{
		let model = await map_loader.get_block_from_blockstate("block/acacia_stairs", { facing: "south", half: "top", shape: "straight" });
		model.position.x = 0;
		model.position.z = -1;
		scene.add(model)
	}
}

function animate(){
	requestAnimationFrame(animate);
	// console.log(grass_model)
	renderer.render(scene, camera);
}
animate()

