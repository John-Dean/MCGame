import { LoadZip } from "./load-zip.js";
import { URLFileSystem } from "./url-filesystem.js";

const load_filesystem	=	async function(url){
	let file_system;
	if(url.indexOf(".zip") >= 0){
		file_system = await LoadZip(url);
	} else if(url[url.length - 1] == "/"){
		file_system = new URLFileSystem(url);
	}
	if(file_system == undefined){
		throw "Invalid format";
	}
	
	return file_system;
}

export { load_filesystem }
