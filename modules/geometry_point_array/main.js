class GeometryPointArray {
	constructor(array){
		if(typeof array == "number" || array instanceof ArrayBuffer){
			array = new Float32Array(array);
		}
		
		this.array = array;
	}
	
	get x(){
		return this.array[0]
	}
	
	set x(value){
		this.array[0] = value;
	}

	get y(){
		return this.array[1]
	}

	set y(value){
		this.array[1] = value;
	}

	get z(){
		return this.array[2]
	}

	set z(value){
		this.array[2] = value;
	}

	get u(){
		return this.array[0]
	}

	set u(value){
		this.array[0] = value;
	}

	get v(){
		return this.array[1]
	}

	set v(value){
		this.array[1] = value;
	}
}

export { GeometryPointArray }
