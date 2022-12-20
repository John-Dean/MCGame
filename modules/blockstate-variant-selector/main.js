
class VariantSelector {
	static pick_weighted(models){
		if(Array.isArray(models)){
			let lowest_weight = Infinity;
			for(let i = 0; i < models.length; i++){
				if(models.weight < lowest_weight){
					lowest_weight = models.weight;
				}
			}
			
			if(lowest_weight == Infinity){
				lowest_weight = 1;
			}
			
			let total_weight = 0;
			let cumulative_weights = [];
			for(let i = 0; i < models.length; i++){
				let weight = models.weight || lowest_weight;
				total_weight += weight;
				cumulative_weights[i] = total_weight;
			}
			
			let random_number = Math.random() * (total_weight)
			
			let random_variant = 0;
			for(let i = 0; i < models.length; i++){
				random_variant = i;
				if(random_number < cumulative_weights[i]){
					break;
				}
			}
			
			return models[random_variant];
		}
		return models
	}
	
	static matches_criteria(key, value, options){
		let values = value.split("|");
				
		let matches_value = false;
		for(let v = 0; v < values.length; v++){
			let value = values[v];
			if(String(value) == String(options[key])){
				matches_value = true;
			}
		}
				
		return matches_value;
	}
	
	static parse_multipart_or(criteria, options){
		for(let key in criteria){
			let value = criteria[key];
			if(matches_criteria(key, value, options)){
				return true;
			}
		}
		return false;
	}
	
	static parse_multipart(blockstate, options){
		let output = [];
		for(let i = 0; i < blockstate.multipart.length; i++){
			let part = blockstate.multipart[i]
			let model = part.apply;
			let criteria = part.when;
			
			let does_apply = true;
			for(let key in criteria){
				let value = criteria[key];
				if(key == "OR"){
					if(!this.parse_multipart_or(value, options)){
						does_apply = false;
						break;
					}
				} else {
					if(!this.matches_criteria(key, value, options)){
						does_apply = false;
						break;
					}
				}
			}
			
			if(does_apply){
				output.push(this.pick_weighted(model));
			}
		}
		
		return output;
	}
		
	static parse_variants(blockstate, options){
		for(let variant_name in blockstate.variants){
			let model	=	blockstate.variants[variant_name];
			
			let criteria = variant_name.split(",");
			let is_correct_variant = true;
			for(let i = 0; i < criteria.length; i++){
				let criteria_options = criteria[i].split("=");
				let key = criteria_options[0];
				let value = criteria_options[1];
				if(key.length == 0){
					// Override for when we have "" as the variant name (default variant)
					continue;
				}
				
				if(!this.matches_criteria(key, value, options)){
					is_correct_variant = false;
					break;
				}
			}
			if(is_correct_variant){
				return [this.pick_weighted(model)];
			}
		}
		
		return [];
	}
	
	static parse_item(item, properties = {}){
		let rotation = 0;
		if(properties.facing == "east"){
			rotation = 90;
		}
		if(properties.facing == "north"){
			rotation = 180;
		}
		if(properties.facing == "west"){
			rotation = 270;
		}
		
		
		for(let i = 0; i < item.overrides.length; i++){
			let part = item.overrides[i]
			let model = part.model;
			let predicate = part.predicate;
			let passed = true;
			for(let key in predicate){
				if(predicate[key] != properties[key]){
					passed = false;
				}
			}
			if(passed){
				return [
					{
						model: model,
						y: rotation
					}
				]
			}
		}
		
		return [];
	}	
	
	static pick_blockstate(blockstate, properties = {}){
		if(properties.is_item){
			return this.parse_item(...arguments);	
		}
		let model = [];
		if(blockstate.variants != undefined){
			model	=	this.parse_variants(blockstate, properties);
		}
		if(blockstate.multipart != undefined){
			model	=	this.parse_multipart(blockstate, properties);
		}
		
		return model;
	}
}

export { VariantSelector }
