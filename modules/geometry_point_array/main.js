class GeometryPointArray extends Float32Array {
	get x(){
		return this[0]
	}
	
	set x(value){
		this[0] = value;
	}

	get y(){
		return this[1]
	}

	set y(value){
		this[1] = value;
	}

	get z(){
		return this[2]
	}

	set z(value){
		this[2] = value;
	}

	get u(){
		return this[0]
	}

	set u(value){
		this[0] = value;
	}

	get v(){
		return this[1]
	}

	set v(value){
		this[1] = value;
	}
}

export { GeometryPointArray }
