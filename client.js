import { THREE, OrbitControls } from "/packaged/node-modules.js"

console.log("Okay")

import { ModelCache } from "./modules/model-cache/main.js"

import { ChunkData } from "./modules/chunk-data/main.js";
import {ChunkToModels} from "./modules/chunk-to-models/main.js";

let model_cache = new ModelCache();
await model_cache.add_resource_pack("/assets/resource-pack/")

let chunk_data = new ChunkData();
await chunk_data.load_world("/assets/world.zip");
let data = await chunk_data.get_chunk_data(1,1)
console.log(data)
let chunk_to_models = new ChunkToModels(model_cache);
let chunk_models = chunk_to_models.convert_to_model(data);

const scene = new THREE.Scene();
const width = window.innerWidth;
const height = window.innerHeight;

// const camera = new THREE.PerspectiveCamera(75, width / height, 0.1, 1000);
const camera = new THREE.OrthographicCamera(width / -2, width / 2, height / 2, height / -2, 1, 1000);

const renderer = new THREE.WebGLRenderer({
	antialias: true
});
console.log(renderer)
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


let sc_variants = await model_cache.get_blockstates("block/stone_bricks");
console.log(sc_variants)
let variant = await model_cache.pick_variant(sc_variants, {facing: "south"});
console.log(variant)
let model = await model_cache.get_model(variant)
console.log(model)
scene.add(model)


function animate(){
	requestAnimationFrame(animate);
	// console.log(grass_model)
	renderer.render(scene, camera);
}
animate()

