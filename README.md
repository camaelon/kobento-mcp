# kobento-mcp

> Part of [Kobento](https://mcp.kobento.dev/), an independent implementation of RemoteCompose, not affiliated
> with Google. [How the repositories fit together](https://mcp.kobento.dev/about/) ·
> [Status and known gaps](https://mcp.kobento.dev/status/)

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

The engines, players and tools are in six sibling repositories. The one map of all of them, with
what each holds and builds on, is [How Kobento fits together](https://mcp.kobento.dev/about/)
(`mcp/lib/about-web.mjs`).
