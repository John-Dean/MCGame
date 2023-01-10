class FileSystem {
	/**
	 * Get the url for a file entry. If the system does not support get url. This should return an empty string.
	 */
	getUrl(name){ return ""; }
	close(){ }
	// extension methods
	async missingFile(name){
		return this.existsFile(name).then((v) => !v);
	}

	async walkFiles(target, walker){
		if(await this.isDirectory(target)){
			const childs = await this.listFiles(target);
			for(const child of childs){
				await this.walkFiles(this.join(target, child), walker);
			}
		} else{
			const result = walker(this.join(target));
			if(result instanceof Promise){
				await result;
			}
		}
	}
}

class URLFileSystem extends FileSystem {
	constructor(root = ""){
		super();
		this.sep = "/";
		this.type = "url";
		this.writeable = false;
		
		if(root.endsWith("/")){
			root = root.substring(0,root.length - 1);
		}
		
		this.root = root;
		this.known_files = {};
	}
	
	getUrl(path){
		return "";
		return [this.root, path].join("/");
	}

	normalizePath(path){
		if(path.startsWith("/")){
			path = path.substring(1);
		}
		if(this.root !== ""){
			path = [this.root, path].join("/");
		}
		return path;
	}

	join(...paths){
		return paths.join("/");
	}
	
	listFiles(path){
		if(path.startsWith("/")){
			path = path.substring(1);
		}
		let file_tree = path.split("/");
		let tree_path = this.known_files;
		
		for(let i = 0; i < file_tree.length; i++){
			const file_name = file_tree[i];
			if(tree_path[file_name] == undefined){
				return []
			}
			tree_path = tree_path[file_name]
		}
		
		let files = [];
		for(let file_name in tree_path){
			if(tree_path[file_name] == true){
				files.push(file_name)
			}
		}
		console.log(files)
		return files;
	}

	readFile(name, encoding){
		const parent = this;
		const file_path = this.normalizePath(name);
		
		return fetch(file_path)
		.then(
			function(response){
				if(!encoding){
					return response.arrayBuffer()
					.then(
						function(buffer){
							return new Uint8Array(buffer);
						}
					)
				}
				if(encoding === "utf-8"){
					return response.text();
				}
				if(encoding === "base64"){
					return response.buffer()
					.then(
						function(buffer){
							return buffer.toString('base64');
						}
					)
				}
				throw new TypeError(`Expect encoding to be utf-8/base64 or empty. Got ${encoding}.`);
			}
		)
		.then(
			function(response){
				if(name.startsWith("/")){
					name = name.substring(1);
				}
				
				let file_tree = name.split("/");
				let tree_path = parent.known_files;
				for(let i = 0; i < file_tree.length; i++){
					const file_name = file_tree[i];
					if(tree_path[file_name] == undefined){
						if(i == file_tree.length - 1){
							tree_path[file_name] = true
						} else{
							tree_path[file_name] = {};
						}
					}
					
					
					tree_path = tree_path[file_name]
				}
				return response;
			}
		)
	}

	existsFile(name){
		try{
			this.readFile(name);
		} catch(error){
			return false;
		}
		return true;
	}

	cd(name){
		if(name.startsWith("/")){
			this.root = name.substring(1);
			return;
		}
		let paths = name.split("/");
		for(let path of paths){
			if(path === "."){
				continue;
			} else if(path === ".."){
				let sub = this.root.split("/");
				if(sub.length > 0){
					sub.pop();
					this.root = sub.join("/");
				}
			} else{
				if(this.root === ""){
					this.root = path;
				} else{
					this.root += `/${path}`;
				}
			}
		}
	}
}

export { URLFileSystem }
