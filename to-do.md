## Merge the output of chunk-to-models into a single mesh


# Rework the cache to identify if a block is a full 16+ x 16+ x 16+ block

# Rework the cache to re-group the groups into squares, and to also include which side they are on (top, bottom, north, east, south, west) if they protrude out of the block

# Rework the chunk-to-models to check if a block is solid, and if it is see if it has solid neighbours
# => if it does, cull the above groups as above on the side the neighbours are on when cloning the geometry (which might mean no clone is needed)

# use buffergeomutils to merge any buffer geometries that are flagged as "full blocks" (perhaps split into y=16 chunks?)

# Take that output and use CSG to merge the remaining geometries on to it
