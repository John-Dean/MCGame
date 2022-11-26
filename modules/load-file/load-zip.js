import { JSZipUtils, openFileSystem } from "/packaged/node-modules.js"

const LoadZip	=	function(url){
	return new Promise(
		function(resolve, reject){
			JSZipUtils.getBinaryContent(url, async function(error, data){
				if(error){
					return reject(error);
				}
				
				const file_system = await openFileSystem(data)
				
				/**
				 * This function is not defined for JSZipFS, and will cause issues when loading textures due to ResourceManager.get because it tries to load in textures from a URL
				 * 
				 * Work around is to use a URL filesystem for these where this is mitigated
				 */
				// file_system.constructor.prototype.getUrl = function(path){
				// 	return "";
				// }
				
				return resolve(file_system)
			});
		}
	);
}

export { LoadZip }
