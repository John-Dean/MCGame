## Setup instructions
```powershell
npm install --legacy-peer-deps
npm install -g webpack-cli
```

## Compiling instructions
```powershell
npm run build
```

This outputs to `/dist/minecraft-threejs-exporter.js`


## To run the demo
Host a webserver in the root project directory and load up `demo/demo.html` in a browser. This loads a few chunks from `demo/world.zip` using the `demo/resource-pack.zip` file as the resource pack.
