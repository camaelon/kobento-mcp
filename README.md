# kobento-mcp

Kobento MCP services: the [Model Context Protocol](https://modelcontextprotocol.io) servers that
let an agent write, convert, render, inspect and publish
[RemoteCompose](https://github.com/androidx/androidx/tree/androidx-main/compose/remote)
documents. They run at https://mcp.kobento.dev/mcp.

```
kobento-mcp/
├── mcp/          the servers (remotecompose-server.mjs is the front door), their library
│                 (mcp/lib) and the VPS deployment (mcp/deploy). See mcp/README.md.
├── examples/     the example catalog, the component library (examples/components) and the
│                 generated corpus; examples/tools/build.mjs builds and verifies them
├── assets/       maps (Natural Earth outlines) and icons (Material Symbols) the components use
├── docs/         component authoring, the examples taxonomy and vocabulary, screen
│                 structures, the 3D guide
└── eval/         the blind prompt evaluation (eval/prompt.md, eval/RUNS.md)
```

## Sibling checkouts

The servers run against other Kobento repositories, checked out next to this one:

```
kobento-mcp/     this repository
kobento-tools/   json2rc (json2rc/build), rc2image and rc2layout (cpp/), the inspector, the icon converter
kobento-libs/    the C++ engine kobento-tools/cpp builds on
kobento-ts/      the TypeScript player: the web bundle published pages embed, the inspector's engine
```

`KOBENTO_TOOLS` and `KOBENTO_TS` point elsewhere (`mcp/lib/siblings.mjs`).

```sh
git clone https://github.com/camaelon/kobento-libs ../kobento-libs
git clone https://github.com/camaelon/kobento-tools ../kobento-tools
git clone https://github.com/camaelon/kobento-ts ../kobento-ts
cmake -S ../kobento-tools/cpp -B ../kobento-tools/cpp/build && cmake --build ../kobento-tools/cpp/build --target rc2image rc2layout -j
npm ci
node mcp/lib/web-player.mjs --build                 # the web player, into kobento-ts/build-mcp
python3 ../kobento-tools/avd/convert_icons.py       # the converted icons (not in git)
npm test
```

On a VPS, `sudo kobento-mcp/mcp/deploy/setup.sh DOMAIN` does all of it under `/opt/kobento`
(see mcp/README.md, "Remote").

## Not from Google

Kobento is an independent implementation of RemoteCompose. It is not affiliated with, endorsed or
supported by Google, and it comes with no support or warranty (Apache 2.0). Official RemoteCompose
code for Android lives in the [AndroidX repository](https://github.com/androidx/androidx/tree/androidx-main/compose/remote).

## The other Kobento repositories

| repository | what |
| :--- | :--- |
| [kobento-libs](https://github.com/camaelon/kobento-libs) | the C++ engine |
| [kobento-ts](https://github.com/camaelon/kobento-ts) | the TypeScript engine and the web player |
| [kobento-tools](https://github.com/camaelon/kobento-tools) | json2rc, the renderers, the inspector, the Android and iOS showcase apps |
| [kobento-desktop](https://github.com/camaelon/kobento-desktop) | the desktop player |
| [kobento-ios](https://github.com/camaelon/kobento-ios) | the iOS engine build and viewer |
| [kobento-mcu](https://github.com/hoford/kobento-mcu) | the microcontroller player: ESP32 boards (M5Stack Tab5, Core2, PaperS3; Waveshare round and AMOLED; Elecrow CrowPanels), STM32U5, Raspberry Pi |
