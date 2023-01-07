import { THREE, OrbitControls } from "/packaged/node-modules.js"

console.log("Okay")

import { MapLoader } from "./modules/map-loader/main.js";

let map_loader = new MapLoader();
await map_loader.add_resource_pack("/assets/resource-pack/")
await map_loader.load_world("/assets/Sample World 2/");

console.log(await map_loader.get_world_data())

const scene = new THREE.Scene();
const width = window.innerWidth;
const height = window.innerHeight;

let range = {
	x_low: 0,
	x_high: 0,
	z_low: 0,
	z_high: 0
}

for(let x = range.x_low; x <= range.x_high; x++){
	for(let z = range.z_low; z <= range.z_high; z++){
		let chunk_models = await map_loader.load_chunk(x, z)
		scene.add(chunk_models)
	}
}



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


function animate(){
	requestAnimationFrame(animate);
	// console.log(grass_model)
	renderer.render(scene, camera);
}
animate()

