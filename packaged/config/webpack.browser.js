const path = require('path');
const fs = require('fs');
const webpack = require('webpack')
const TerserPlugin = require('terser-webpack-plugin');
const ReplaceInFileWebpackPlugin = require('replace-in-file-webpack-plugin');

const webpack_config = {
	mode  : "production",
	devtool : "source-map",
	entry : path.resolve(__dirname, '../node-modules.js'),
	output: {
		path    : path.resolve(__dirname, '../browser/'),
		filename: 'node-modules.browser.js',
		library : {
			type: 'module'
		},
		chunkLoading: 'import',
		chunkFormat : 'module'
	},
	experiments: {
		outputModule: true
	},
	resolve: {
		modules: ["node_modules", path.resolve(__dirname, "node_replacement")],
		alias  : {
			stream: require.resolve('stream-browserify'),
			zlib  : require.resolve('browserify-zlib'),
			timers: require.resolve('timers-browserify')
		}
	},
	optimization: {
		minimize : false,
		minimizer: [
			new TerserPlugin({
				parallel: true
			})
		]
	},
	plugins: [
		// fix "process is not defined" error:
		// (do "npm install process" before running the build)
		new webpack.ProvidePlugin({
			process: 'process/browser'
		}),
		new ReplaceInFileWebpackPlugin([{
			dir  : path.resolve(__dirname, '..'),
			files: ['node-modules.js'],
			rules: [
				{
					search : new RegExp('delete canvases;', 'g'),
					replace: ''
				}
				// ,{
				// 	search : new RegExp('async getRegionData', 'g'),
				// 	replace: `
				// 		async getEntityData(chunkX, chunkZ) {
				// 			// The region file coord with chunk is chunk coord shift by 5
				// 			let path = this.fs.join("entities", \`r.\$\{chunkX >> 5\}.\$\{chunkZ >> 5\}.mca\`);
				// 			let buffer = await this.fs.readFile(path);
				// 			let off = getChunkOffset(buffer, chunkX, chunkZ);
				// 			let lengthBuf = buffer.slice(off, off + 4);
				// 			let length = lengthBuf[0] << 24 | lengthBuf[1] << 16 | lengthBuf[2] << 8 | lengthBuf[3];
				// 			let format = buffer[off + 4];
				// 			if (format !== 1 && format !== 2) {
				// 				throw new Error('Illegal Chunk format '+ format + 'on (' + chunkX + ', ' + chunkZ + '})!');
				// 			}
				// 			let compressed = format === 1 ? "gzip" : "deflate";
				// 			let chunkData = buffer.slice(off + 5, off + 5 + length);
				// 			let data = await deserialize(chunkData, { compressed });
				// 			return data;
				// 		}
					
					
				// 		async getRegionData`
				// }
			]
		}])
	]
};

 
const redirect_package	=	function(package_name, replace_text = "esm", replace_with = "browser", from_field = webpack_config.output.library.type){
	let package_path = path.dirname(require.resolve(package_name + "/package.json"))
	let raw_data = fs.readFileSync(package_path + "/package.json")
	let package_json = JSON.parse(raw_data);
	
	let from_file = package_json[from_field];
	let to_file = from_file.replace(replace_text, replace_with);
	
	webpack_config.resolve.alias[package_name] = package_name + "/" + to_file;
}

redirect_package("@xmcl/system", "esm", "browser")

module.exports = webpack_config;
