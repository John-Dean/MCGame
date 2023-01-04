import { THREE, OrbitControls } from "/packaged/node-modules.js"


import { ModelCache } from "./modules/model-cache/main.js"


const scene = new THREE.Scene();
const width = window.innerWidth;
const height = window.innerHeight;


let model_cache = new ModelCache();
await model_cache.add_resource_pack("/assets/resource-pack/")

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


let sc_variants = await model_cache.get_blockstates("block/oak_stairs");
console.log(sc_variants)
let variant = await model_cache.pick_variant(sc_variants, { facing: "east", in_wall: false, open: false, half: "bottom", shape: "straight" });
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

