// Component sets: another look for the library, swapped in by "componentSet" (components.mjs).

import test from "node:test";
import assert from "node:assert/strict";
import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { checkComponentSet, componentInterface, componentSets, expandComponents, LIBRARY_DIR, loadComponentSet, loadLibrary } from "./components.mjs";

const doc = (extra = {}) => ({ header: { apiLevel: 7, width: 300, height: 120 }, ...extra,
    root: { column: { children: [{ Button: { label: "Pay", style: "outlined" } }, { Card: { slots: { content: [{ text: { value: "x" } }] } } }] } } });

test("the example set is listed, and changes what it defines only", () => {
    assert.ok(componentSets().some((s) => s.name === "square" && s.components.includes("Button") && s.theme));
    const set = loadComponentSet("square");
    assert.deepEqual(set.overrides, ["Button"]);
    assert.equal(set.components.get("Card"), loadLibrary().components.get("Card"));
    assert.equal(set.theme.numbers.radius_md, 4);
    assert.equal(set.theme.numbers.space_4, loadLibrary().theme.numbers.space_4, "tokens it does not set come from the library");
    assert.equal(loadComponentSet("default"), loadLibrary());
    assert.throws(() => loadComponentSet("nope"), /no set named "nope" \(there are: default, .*square/);
});

test("componentSet in a document expands its calls with the set, and is removed", () => {
    const plain = JSON.stringify(expandComponents(doc(), { mode: "expand" }).doc);
    const square = expandComponents(doc({ componentSet: "square" }), { mode: "expand" }).doc;
    assert.equal(square.componentSet, undefined);
    assert.notEqual(JSON.stringify(square), plain);
    assert.match(JSON.stringify(square), /"padding":2\.5/, "the set's Button: a 2.5 dp ring");
    assert.doesNotMatch(plain, /"padding":2\.5/);
    // The option wins over the document.
    assert.equal(JSON.stringify(expandComponents(doc({ componentSet: "square" }), { mode: "expand", componentSet: "default" }).doc), plain);
});

test("checkComponentSet: the example set keeps the interface; a broken one is caught", () => {
    assert.equal(checkComponentSet("square").ok, true);
    const dir = mkdtempSync(path.join(tmpdir(), "rc-sets-"));
    try {
        const def = JSON.parse(readFileSync(path.join(LIBRARY_DIR, "Button", "component.json"), "utf8"));
        delete def.params.fill;
        def.params.style.values = ["filled", "outlined"];
        def.params.label.type = "float";
        def.params.size = { type: "float", required: true, doc: "new" };
        def.slots.icon.optional = false;
        mkdirSync(path.join(dir, "broken", "Button"), { recursive: true });
        writeFileSync(path.join(dir, "broken", "Button", "component.json"), JSON.stringify(def));
        const r = checkComponentSet("broken", { dir });
        assert.equal(r.ok, false);
        const errs = r.components[0].errors.join("\n");
        for (const want of [/'fill' is missing/, /lost the value "text"/, /'label' is float/, /'size' is new and required/, /slot 'icon' is required/]) assert.match(errs, want);
    } finally { rmSync(dir, { recursive: true, force: true }); }
});

test("componentInterface: params with type, default, static, values; slots", () => {
    const i = componentInterface(loadLibrary().components.get("Button"));
    assert.deepEqual(i.params.style, { type: "enum", default: "filled", static: true, values: ["filled", "outlined", "text"] });
    assert.equal(i.params.label.required, true);
    assert.deepEqual(i.slots, { icon: { optional: true } });
});
