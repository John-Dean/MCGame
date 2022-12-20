import { BlockModelFactory } from "@xmcl/model";
export { BlockModelFactory }

import { WorldReader, RegionReader } from "@xmcl/world";
export { WorldReader, RegionReader }

import { ModelLoader, ResourceLocation, ResourceManager, ResourcePack, readIcon, readPackMeta, readPackMetaAndIcon } from "@xmcl/resourcepack"
export { ModelLoader, ResourceLocation, ResourceManager, ResourcePack, readIcon, readPackMeta, readPackMetaAndIcon }


const JSZip = require("jszip");
const JSZipUtils = require("jszip-utils");
export { JSZip, JSZipUtils }


import { FileSystem, openFileSystem, resolveFileSystem } from "@xmcl/system"
export { FileSystem, openFileSystem, resolveFileSystem }

import { deserialize } from '@xmcl/nbt';
export { deserialize }

import * as THREE from 'three';
import * as BufferGeometryUtilsTemp from 'three/examples/jsm/utils/BufferGeometryUtils'
let BufferGeometryUtils = BufferGeometryUtilsTemp;
if(BufferGeometryUtilsTemp.BufferGeometryUtils != undefined){
	BufferGeometryUtils = BufferGeometryUtilsTemp.BufferGeometryUtils
}
import { Earcut } from 'three/src/extras/Earcut';
export { Earcut }

import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls'
export { THREE, OrbitControls, BufferGeometryUtils };
// import * as BVH from 'three-mesh-bvh';
// import * as CSG from 'three-bvh-csg';
// THREE.BufferGeometry.prototype.computeBoundsTree = BVH.computeBoundsTree;
// THREE.BufferGeometry.prototype.disposeBoundsTree = BVH.disposeBoundsTree;
// THREE.Mesh.prototype.raycast = BVH.acceleratedRaycast;
// export { BVH, CSG };


import { CSG } from 'three-csg-ts';
import { Node as CSGNode } from 'three-csg-ts/lib/esm/Node';
export { CSG, CSGNode };

