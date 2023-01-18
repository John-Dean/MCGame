import { THREE, ImageInBrowser } from "/packaged/node-modules.js";

class MinecraftTexture extends THREE.DataTexture {
	constructor(hasLoadedPromise, ...args){
		super(...args);
		this.hasLoaded = hasLoadedPromise
	}
}

class ResourceTextureManager {
	constructor(textures){
		this.textures = textures;
	}
	
	hasTexture(path){
		return !!this.textures[path];
	}

	loadTexture(path){
		let resolveFn, rejectFn;
		const promise = new Promise(function(resolve, reject){
			resolveFn = resolve;
			rejectFn = reject;
		})
		
		const texture = new MinecraftTexture(promise)

		const fileReadPromise = this.textures[path].read();
		Promise.resolve(fileReadPromise)
		.then(
			function(fileContents){
				const decodedContents = ImageInBrowser.decodeImage(fileContents);
				if(decodedContents == undefined){
					throw "Error decoding the image";
				}
				const width = decodedContents?.width;
				const height = decodedContents?.height;
				
				if(width == undefined || height == undefined){
					throw "Error finding width or height";
				}
				
				const imageDataArray = decodedContents.getBytes();
				
				const imageDataArrayClamped = new Uint8ClampedArray(imageDataArray);
				
				const imageData = new ImageData(imageDataArrayClamped, width, height);
				
				if(texture != undefined){
					texture.image = imageData;
					texture.needsUpdate = true;
				}

				return texture;
			}
		)
		.then(resolveFn)
		.catch(rejectFn)

		// Overwrite to true as Texture defaults to true and DataTexture to false
		texture.flipY = true;
		
		texture.magFilter = THREE.NearestFilter;
		texture.minFilter = THREE.LinearFilter;

		return texture;
	}
}

export { ResourceTextureManager }
