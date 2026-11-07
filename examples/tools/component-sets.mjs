#!/usr/bin/env node
// Component sets from the command line (docs/COMPONENT_AUTHORING.md, "In a component set"):
//   node examples/tools/component-sets.mjs list               the sets, and what each changes
//   node examples/tools/component-sets.mjs interface [set]    every component's params and slots
//                                                              (as JSON), as the set has them
//   node examples/tools/component-sets.mjs check <set>        the set against the library's
//                                                              interface; exits 1 on an error
import { checkComponentSet, componentInterface, componentSets, loadComponentSet } from "../../mcp/lib/components.mjs";

const [cmd = "list", name] = process.argv.slice(2);
if (cmd === "list") {
    console.log("default  the library itself");
    for (const s of componentSets()) {
        console.log(`${s.name}  ${s.summary}`);
        console.log(`  components: ${s.components.join(", ") || "none"}${s.theme ? "; its own theme tokens" : ""}`);
    }
} else if (cmd === "interface") {
    const lib = loadComponentSet(name);
    const out = {};
    for (const n of [...lib.components.keys()].sort()) out[n] = { ...(lib.components.get(n).set ? { from: "set" } : {}), ...componentInterface(lib.components.get(n)) };
    console.log(JSON.stringify(out, null, 1));
} else if (cmd === "check" && name) {
    const r = checkComponentSet(name);
    for (const c of r.components) {
        for (const e of c.errors) console.log(`error   ${c.component}: ${e}`);
        for (const w of c.warnings) console.log(`warning ${c.component}: ${w}`);
    }
    console.log(r.ok ? `${name}: ok (${r.components.length} component${r.components.length === 1 ? "" : "s"} checked${r.added.length ? `, adds ${r.added.join(", ")}` : ""}${r.theme ? ", its own theme" : ""})` : `${name}: errors`);
    process.exit(r.ok ? 0 : 1);
} else {
    console.error("usage: component-sets.mjs list | interface [set] | check <set>");
    process.exit(2);
}
