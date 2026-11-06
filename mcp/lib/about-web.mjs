// Three plain pages of the site, next to the privacy notice:
//   GET <base>/about/   how Kobento fits together: the layers from the format to the apps, and
//                       every repository (the one map of them; the READMEs link here)
//   GET <base>/tools/   the MCP servers and every tool, read from the servers' own definitions
//   GET <base>/status/  what is solid, the parity numbers, and the known gaps
// The numbers on the status page come from the repositories' docs (kobento-libs docs/PROGRESS.md,
// UPSTREAM_CHANGES.md, MISSING_SUPPORT.md; kobento-tools json2rc/README.md and android/README.md;
// kobento-mcu's board READMEs) and from the catalog (Java-identical examples): keep them in step.

import { siteFooter } from "./privacy-web.mjs";

const GH = "https://github.com/camaelon";
const MCU = "https://github.com/hoford/kobento-mcu";
const repo = (name) => `<a class="repo" href="${name === "kobento-mcu" ? MCU : `${GH}/${name}`}">${name}</a>`;
const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[c]);

export const ABOUT_CSS = `
.about h3{font-size:16px;margin:20px 0 6px}
.about code{font:13px ui-monospace,Menlo,monospace;background:var(--chip);padding:2px 6px;border-radius:6px}
.about pre{background:var(--chip);padding:12px 14px;border-radius:10px;overflow-x:auto;font:13px/1.5 ui-monospace,Menlo,monospace}
.about pre code{background:none;padding:0}
.about table{border-collapse:collapse;width:100%;font-size:14px;margin:8px 0 16px}
.about th,.about td{text-align:left;vertical-align:top;padding:6px 8px;border-bottom:1px solid var(--line)}
.about th{font-weight:600;color:var(--muted)}
.about td:first-child{white-space:nowrap}
.layers{display:flex;flex-direction:column;gap:0;margin:16px 0 8px}
.layer{display:grid;grid-template-columns:120px 1fr;gap:12px;align-items:start;padding:12px;border:1px solid var(--line);border-radius:12px;background:var(--card)}
.layer .name{font-weight:700;font-size:14px;padding-top:6px}
.layer .name small{display:block;font-weight:400;color:var(--muted);font-size:12px}
.layer .boxes{display:flex;flex-wrap:wrap;gap:8px}
.box{border:1px solid var(--line);border-radius:10px;padding:6px 10px;font-size:13px;line-height:1.35;background:var(--bg);flex:1 1 150px}
.box b{display:block;font-size:13px}
.box.ext{border-style:dashed}
.box.planned{opacity:.7;border-style:dotted}
.arrow{text-align:center;color:var(--muted);font-size:18px;line-height:22px}
.repo{font:12px ui-monospace,Menlo,monospace}
.legend{font-size:13px;color:var(--muted)}
.about a{color:var(--accent)}
.tools-server{margin:24px 0 8px}
.tools-server td:first-child{width:210px}
.tools-server p{margin:4px 0 8px}
@media (max-width:560px){.layer{grid-template-columns:1fr;gap:6px}.layer .name{padding-top:0}}`;

function shell(site, { current, title, sub, body, prefix = "../" }) {
    return `<!doctype html>
<html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1">
<title>${esc(title)}</title><meta name="description" content="${esc(sub)}">${site.fonts ?? ""}<style>${site.css}${ABOUT_CSS}</style></head>
<body>
<header>
<nav>${site.nav(current)}</nav>
<h1>${esc(title)}</h1>
<p class="sub">${esc(sub)}</p>
</header>
<main class="privacy about">${body}</main>
${siteFooter(prefix)}
</body></html>`;
}

const box = (title, text, repos = [], cls = "") =>
    `<div class="box${cls ? " " + cls : ""}"><b>${title}</b>${text}${repos.length ? `<br>${repos.map(repo).join(" ")}` : ""}</div>`;
const layer = (name, note, boxes) => `<div class="layer"><div class="name">${name}<small>${note}</small></div><div class="boxes">${boxes.join("")}</div></div>`;
const ARROW = `<div class="arrow" aria-hidden="true">↓</div>`;

/** How it fits together: the layers, then the repositories. */
export function aboutPage(site) {
    const body = `
<p>RemoteCompose is a format: a small binary document (<code>.rc</code>) that a player draws, with
layout, text, animation and touch. Android defines it. Kobento is an independent implementation: engines
that read the format, players built on them for more platforms, the tools to write and check documents,
and the MCP servers that let an assistant do it. It is not affiliated with Google.</p>

<div class="layers" role="list" aria-label="Kobento's layers, from writing a document to the apps that show it">
${layer("Write", "by hand or with AI", [
        box("MCP servers", "An assistant finds components and examples, writes the JSON, converts, renders, checks and publishes it. <a href=\"../tools/\">The tools</a>.", ["kobento-mcp"]),
        box("Components and examples", "The library and the catalog this site shows, with their JSON.", ["kobento-mcp"]),
        box("json2rc", "Converts RemoteCompose JSON to <code>.rc</code>, byte for byte as Android's own JSON parser does.", ["kobento-tools"]),
    ])}
${ARROW}
${layer("Format", "the document", [
        box("RemoteCompose <code>.rc</code>", "The spec and the reference player are in androidx (Google).", [], "ext"),
        box("Kobento's 3D extension", "3D meshes, lights and cameras: Kobento's engines play them, androidx's player does not.", ["kobento-libs", "kobento-ts"]),
    ])}
${ARROW}
${layer("Engines", "read and run it", [
        box("C++ engine", "Parses, lays out and runs a document; paints through Skia, Core Graphics or ThorVG.", ["kobento-libs"]),
        box("TypeScript engine", "The same, in the browser, on a canvas or WebGL.", ["kobento-ts"]),
    ])}
${ARROW}
${layer("Players", "on each platform", [
        box("Web", "Every published page embeds it.", ["kobento-ts"]),
        box("Desktop", "<code>rcviewer</code> for macOS and Linux.", ["kobento-desktop"]),
        box("iOS", "The engine built for iPhone and iPad, Skia on Metal, and a viewer.", ["kobento-ios"]),
        box("Microcontrollers", "ESP32 boards, STM32U5, Raspberry Pi: the C++ engine on ThorVG.", ["kobento-mcu"]),
        box("Android", "Google's androidx player.", [], "ext"),
    ])}
${ARROW}
${layer("Deliver", "get it to people", [
        box("Published pages", "One HTML page per document, at a public URL.", ["kobento-mcp"]),
        box("The stream", "Pages people chose to share, with votes.", ["kobento-mcp"]),
        box("Pushing to a device", "Networking for microcontrollers. Planned (kobento-net).", [], "planned"),
    ])}
${ARROW}
${layer("Apps", "built on it", [
        box("Showcase apps", "Android (androidx's player) and iOS (Kobento's): the showcases, the stream, your pages.", ["kobento-tools"]),
        box("Microcontroller apps", "Home Assistant, Muse and Wi-Fi set-up. Planned as kobento-mcuApps, not public yet.", [], "planned"),
    ])}
</div>
<p class="legend">Solid border: Kobento. Dashed: Google's. Dotted: planned.</p>

<h2>The repositories</h2>
<p>All open source, under the Apache 2.0 license. They are checked out side by side: each README says
which siblings it builds against.</p>
<table>
<thead><tr><th>Repository</th><th>What is in it</th><th>Builds on</th></tr></thead>
<tbody>
<tr><td>${repo("kobento-libs")}</td><td>The C++ engine (<code>rccore</code>), its Skia bridge (<code>rcskia</code>), samples, the spec notes.</td><td>Skia</td></tr>
<tr><td>${repo("kobento-ts")}</td><td>The TypeScript engine and the web player.</td><td>—</td></tr>
<tr><td>${repo("kobento-tools")}</td><td>json2rc, the renderers (<code>rc2image</code>, <code>rc2layout</code>), the inspector, the converters (Lottie, Android vector drawables), conformance against Android's reference, and the Android and iOS showcase apps.</td><td>kobento-libs, kobento-ts, kobento-ios, kobento-mcp</td></tr>
<tr><td>${repo("kobento-desktop")}</td><td>The desktop player for macOS and Linux.</td><td>kobento-libs</td></tr>
<tr><td>${repo("kobento-ios")}</td><td>The engine built for iOS, a Core Graphics backend without Skia, and a viewer.</td><td>kobento-libs</td></tr>
<tr><td>${repo("kobento-mcu")}</td><td>The microcontroller player: ESP32 boards, STM32U5, Raspberry Pi.</td><td>the C++ engine, ThorVG</td></tr>
<tr><td>${repo("kobento-mcp")}</td><td>The MCP servers, the components and examples, and this site.</td><td>kobento-tools, kobento-ts</td></tr>
</tbody>
</table>
<p>The older monorepo, <code>remotecompose-experiments</code>, is where this started; the work now
happens in the repositories above.</p>

<h2>Where to start</h2>
<ul>
<li><b>Build a screen with an assistant:</b> <a href="../account/">create an account</a> and add the MCP server (<a href="../#how">how</a>).</li>
<li><b>Write the JSON yourself:</b> <a href="../#by-hand">by hand</a>, with json2rc and a player.</li>
<li><b>Play documents in your app:</b> the engines above; on Android, androidx's player.</li>
<li><b>What works and what does not:</b> <a href="../status/">the status page</a>.</li>
</ul>`;
    return shell(site, { current: "about", title: "How Kobento fits together", sub: "From the format to the apps, and which repository holds what.", body });
}

let toolsCache = null;
/** The servers and their tools, from the definitions the servers run with. */
async function serverTools() {
    if (toolsCache) return toolsCache;
    const servers = [
        ["guide", "Guide", "Which server and tool fits a task, and every option of each."],
        ["examples", "Examples and components", "The catalog and the component library: where an assistant starts a new document."],
        ["json2rc", "Converter", "RemoteCompose JSON to a binary .rc."],
        ["rc-render", "Renderer", "Pictures of a document with the C++ engine, and validation."],
        ["inspect", "Inspector", "What is inside a document and how it behaves, run headless with the TypeScript engine."],
        ["deploy", "Publishing", "Web pages for documents, and the stream."],
    ];
    const out = [];
    for (const [file, title, about] of servers) {
        const { definition } = await import(`../${file}-server.mjs`);
        out.push({ title, about, name: definition.name, tools: definition.tools.map((t) => ({ name: t.name, text: firstSentence(t.description ?? "") })) });
    }
    return (toolsCache = out);
}

/** A tool's description cut to its first sentence, and that to about 170 characters at a clause. */
function firstSentence(s) {
    const text = s.replace(/\s+/g, " ").trim().replace(/\b(e\.g|i\.e|etc)\./g, "$1\u0000");
    const m = /^(.+?[.!?])(\s|$)/.exec(text);
    let out = (m ? m[1] : text).replace(/\u0000/g, ".");
    if (out.length > 170) {
        const head = out.slice(0, 170);
        const cut = Math.max(head.lastIndexOf(": "), head.lastIndexOf("; "), head.lastIndexOf(", "), head.lastIndexOf(" ("));
        out = (cut > 60 ? head.slice(0, cut) : head.slice(0, head.lastIndexOf(" "))).replace(/[,;:(]$/, "") + "…";
    }
    return out;
}

/** Every MCP server and tool, so what an assistant can do is concrete before signing up. */
export async function toolsPage(site, mcpUrl) {
    const servers = await serverTools();
    const count = servers.reduce((n, s) => n + s.tools.length, 0);
    const body = `
<p>Kobento's MCP server at <code>${esc(mcpUrl)}</code> gives an assistant ${count} tools, in ${servers.length} groups.
An assistant usually starts with <code>build_kit</code>, writes the document, checks it with <code>render_rc</code>,
<code>audit</code> and <code>try_controls</code>, and publishes it with <code>package_web</code>. You need an
<a href="../account/">account</a> to use them.</p>
${servers.map((s) => `<section class="tools-server"><h2>${esc(s.title)} <span class="repo">${esc(s.name)}</span></h2><p>${esc(s.about)}</p>
<table><tbody>${s.tools.map((t) => `<tr><td><code>${esc(t.name)}</code></td><td>${esc(t.text).replace(/`([^`]+)`/g, "<code>$1</code>")}</td></tr>`).join("")}</tbody></table></section>`).join("\n")}
<p>The <code>describe</code> tool gives each one's full options with examples. The servers' code is in ${repo("kobento-mcp")}.</p>`;
    return shell(site, { current: "tools", title: "The MCP tools", sub: `The ${count} tools an assistant gets, and what each one does.`, body });
}

/** What is solid, the measured parity, and the known gaps. catalog: {examples, javaIdentical}. */
export function statusPage(site, catalog) {
    const body = `
<p><b>Kobento is pre-1.0 and experimental.</b> The formats it reads are Android's, but its own JSON
extensions, components and tools can still change. The service runs on a best-effort basis. Nothing
here is supported by Google.</p>

<h2>Measured against Android's reference</h2>
<table>
<thead><tr><th>What</th><th>Result</th></tr></thead>
<tbody>
<tr><td>C++ engine, reading documents</td><td>All 80 reference sample documents and 59 advanced samples parse with no field different from Android's own reader.</td></tr>
<tr><td>C++ engine, 3D</td><td>Bit-exact with the androidx reference renderer: 49 of 49 scenes, 111 of 111 documents.</td></tr>
<tr><td>json2rc</td><td>Byte-identical, on all 345 documents of its test corpus, to the converter it was ported from, which is itself checked against Android's JSON parser.</td></tr>
<tr><td>This site's examples</td><td>${catalog.javaIdentical} of ${catalog.examples} convert to exactly the bytes Android's JSON parser writes. The others use what that parser writes differently or not at all, Kobento's 3D extension among them.</td></tr>
<tr><td>TypeScript engine</td><td>Knows 162 of Android's 163 operations (the missing one is not registered in Android's player either). 17 of them are read and ignored, and 14 more are placeholders that skip their bytes. ${link("kobento-libs/blob/main/docs/MISSING_SUPPORT.md", "The list")}.</td></tr>
</tbody>
</table>

<h2>Known gaps</h2>
<ul>
<li><b>Two engines.</b> Published pages play with the TypeScript engine; pictures from the renderer come from the C++ engine. They can differ, so check the page itself.</li>
<li><b>Android.</b> The Android app plays documents with Google's androidx player. It does not have Kobento's 3D extension (SHW-15 to SHW-20), and a few showcases hit bugs in it (SHW-23 to SHW-28). ${link("kobento-tools/blob/main/android/README.md", "Which play")}.</li>
<li><b>Apps.</b> The Android and iOS showcase apps are not in the stores: build them from ${repo("kobento-tools")}.</li>
<li><b>Platforms.</b> No Windows player yet. The engine is portable C++17.</li>
<li><b>Microcontrollers.</b> The ESP32 player shows documents built into its firmware: sending documents to a device (kobento-net) is planned. Animation is slow on the M5Stack Core2, and an e-paper screen takes 0.5 to 2 seconds to refresh. The integrations (Home Assistant, the Muse gadget) are in kobento-mcuApps, which is not public yet; the Muse gadget also needs Muse's own SDK and a token. ${`<a href="${MCU}">kobento-mcu</a>`} has each board's state.</li>
</ul>

<h2>Reporting a problem</h2>
<p>Open an issue in the repository it concerns (<a href="../about/">which one</a>). For the site and the MCP servers, that is ${repo("kobento-mcp")}.</p>`;
    return shell(site, { current: "status", title: "Status", sub: "Pre-1.0: what is measured, and what does not work yet.", body });
}

function link(pathInGh, text) { return `<a href="${GH}/${pathInGh}">${text}</a>`; }
