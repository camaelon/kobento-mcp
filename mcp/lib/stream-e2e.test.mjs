// The stream end to end, through the examples server: public name, posting a published page,
// the stream page (both orders), votes (form and JSON), removal, and what a stranger cannot do.

import test from "node:test";
import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { createServer } from "node:http";
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { csrfFor, openAccounts } from "./accounts.mjs";

const SERVER = path.join(path.dirname(fileURLToPath(import.meta.url)), "..", "examples-server.mjs");
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function freePort() {
    const s = createServer();
    await new Promise((r) => s.listen(0, "127.0.0.1", r));
    const { port } = s.address();
    await new Promise((r) => s.close(r));
    return port;
}

async function start() {
    const port = await freePort();
    const root = mkdtempSync(path.join(tmpdir(), "rc-stream-e2e-"));
    const child = spawn(process.execPath, [SERVER, "--http"], {
        env: { ...process.env, MCP_HTTP_PORT: String(port), MCP_ROOT: root, RC_ACCOUNTS: "1", MCP_TOKEN: "admin-secret-token-0123456789abcdef",
            RC_ACCOUNT_URL: `http://127.0.0.1:${port}/account/`, RC_DB: "", RC_EMAIL_VERIFY: "off", RC_SIGNUP: "", RESEND_API_KEY: "",
            RC_ADMIN_EMAILS: "boss@example.com" },
        stdio: ["ignore", "ignore", "pipe"],
    });
    let log = "";
    child.stderr.on("data", (d) => { log += d; });
    const base = `http://127.0.0.1:${port}`;
    for (let i = 0; i < 300; i++) { try { if ((await fetch(`${base}/healthz`)).ok) break; } catch {} await sleep(100); }
    const post = (p, form, cookie, headers = {}) => fetch(`${base}${p}`, { method: "POST", redirect: "manual",
        headers: { Origin: base, "Content-Type": "application/x-www-form-urlencoded", ...(cookie ? { Cookie: `rc_session=${cookie}` } : {}), ...headers },
        body: new URLSearchParams(form) });
    const get = (p, cookie) => fetch(`${base}${p}`, { headers: cookie ? { Cookie: `rc_session=${cookie}` } : {} });
    return { base, root, post, get, log: () => log, stop: () => { child.kill(); rmSync(root, { recursive: true, force: true }); } };
}

const sidOf = (res) => /rc_session=([^;]*)/.exec(res.headers.get("set-cookie") ?? "")?.[1];

/** A published page as the deploy server leaves it: pages/<id>/meta.json (+ preview), and its row. */
async function publish(s, accountId, id, title) {
    const dir = path.join(s.root, "pages", id);
    mkdirSync(dir, { recursive: true });
    writeFileSync(path.join(dir, "meta.json"), JSON.stringify({ id, title, created: new Date().toISOString(), rc_bytes: 1234, document: { width: 320, height: 200 }, preview: true }));
    writeFileSync(path.join(dir, "index.html"), "<!doctype html><title>page</title>");
    const store = await openAccounts(path.join(s.root, "rc.db"));
    store.recordPage({ id, accountId, title, url: `${s.base}/pages/${id}/` });
    store.close();
}

test("stream: post, list, vote, sort, remove", async (t) => {
    const s = await start();
    t.after(() => s.stop());
    const reg = async (email) => {
        const r = await s.post("/account/register", { email, name: "" });
        assert.equal(r.status, 200, s.log());
        return sidOf(r);
    };
    const ann = await reg("ann@example.com"), bob = await reg("bob@example.com"), boss = await reg("boss@example.com");
    const ids = await (async () => { const st = await openAccounts(path.join(s.root, "rc.db")); const r = ["ann", "bob"].map((n) => st.findAccount(`${n}@example.com`).id); st.close(); return r; })();
    const P1 = "a".repeat(22), P2 = "b".repeat(22), PB = "c".repeat(22);
    await publish(s, ids[0], P1, "Clock");
    await publish(s, ids[0], P2, "Weather");
    await publish(s, ids[1], PB, "Bob's page");

    // Empty, and the nav has the tab.
    let page = await (await s.get("/stream/")).text();
    assert.match(page, /Nothing in the stream yet/);
    assert.match(page, /href="\.\.\/stream\/" aria-current="page"[^>]*>Stream/);
    assert.match(page, /Sign in<\/a> to vote/);

    // Posting needs a name (registration left it empty); the account page says so.
    let acctPage = await (await s.get("/account/", ann)).text();
    assert.match(acctPage, /id="name"/);
    assert.match(acctPage, /<summary class="link">Post to the stream<\/summary>/);
    let r = await s.post("/account/stream", { csrf: csrfFor(ann), page_id: P1, title: "My clock" }, ann);
    assert.equal(r.status, 400);
    assert.match(await r.text(), /Set your name first/);
    r = await s.post("/account/name", { csrf: csrfFor(ann), name: "Ann K" }, ann);
    assert.equal(r.status, 303);
    await s.post("/account/name", { csrf: csrfFor(bob), name: "Bob" }, bob);

    // Post two pages; a stranger's page is refused; a stale form is refused.
    assert.equal((await s.post("/account/stream", { csrf: csrfFor(ann), page_id: P1, title: "My clock", tags: "Clock, #Time widget" }, ann)).status, 303);
    await sleep(5);
    assert.equal((await s.post("/account/stream", { csrf: csrfFor(ann), page_id: P2, title: "Weather <b>now</b>", tags: "widget" }, ann)).status, 303);
    r = await s.post("/account/stream", { csrf: csrfFor(ann), page_id: P2, title: "Weather <b>now</b>", tags: "a b c d e f g" }, ann);
    assert.equal(r.status, 400);
    assert.match(await r.text(), /At most 6 tags/);
    r = await s.post("/account/stream", { csrf: csrfFor(ann), page_id: PB, title: "Not mine" }, ann);
    assert.match(await r.text(), /only post your own/);
    assert.equal((await s.post("/account/stream", { csrf: "nope", page_id: PB, title: "x" }, bob)).status, 403);

    page = await (await s.get("/stream/")).text();
    assert.ok(page.indexOf("Weather &lt;b&gt;now&lt;/b&gt;") < page.indexOf("My clock"), "newest first, title escaped");
    assert.match(page, /by Ann K/);
    assert.match(page, new RegExp(`href="${s.base}/pages/${P1}/"`), "a card opens the published page");
    assert.match(page, new RegExp(`src="${s.base}/pages/${P1}/preview.png"`));
    assert.match(page, /2 items/);

    // Tags: on the cards, in the bar (most used first), and ?tag= filters, keeping the sort.
    assert.match(page, new RegExp(`id="s-${P1}"[\\s\\S]*?<div class="tags"><a href="\\./\\?tag=clock">#clock</a><a href="\\./\\?tag=time">#time</a><a href="\\./\\?tag=widget">#widget</a></div>`));
    assert.match(page, /<div class="tagbar"><span class="label">Tags:<\/span><a href="\.\/" aria-current="true">all<\/a><a href="\.\/\?tag=widget">#widget<span class="n">2<\/span>/);
    let tagged = await (await s.get("/stream/?tag=Clock")).text();
    assert.match(tagged, /My clock/);
    assert.ok(!tagged.includes("Weather"), "only the tagged item");
    assert.match(tagged, /1 item tagged #clock/);
    assert.match(tagged, /href="\.\/\?sort=top&amp;tag=clock"|href="\.\/\?sort=top&tag=clock"/);
    assert.match(await (await s.get("/stream/?tag=nothing")).text(), /Nothing tagged #nothing/);
    // A vote from a filtered page comes back to it.
    r = await s.post(`/stream/${P2}/vote?tag=widget`, { csrf: csrfFor(bob), value: "1" }, bob);
    assert.equal(r.headers.get("location"), `../?tag=widget#s-${P2}`);
    await s.post(`/stream/${P2}/vote`, { csrf: csrfFor(bob), value: "0" }, bob);
    // Renaming keeps the tags unless they are sent; sent empty, they go.
    acctPage = await (await s.get("/account/", ann)).text();
    assert.match(acctPage, /name="tags" maxlength="200" value="clock, time, widget"/);
    await s.post("/account/stream", { csrf: csrfFor(ann), page_id: P2, title: "Weather <b>now</b>", tags: "" }, ann);
    assert.ok(!(await (await s.get("/stream/?tag=widget")).text()).includes("Weather"));

    // Votes: the form redirects back; JSON answers the score; one per account, replaced, taken back.
    r = await s.post(`/stream/${P1}/vote`, { csrf: csrfFor(bob), value: "1" }, bob);
    assert.equal(r.status, 303);
    assert.equal(r.headers.get("location"), `../#s-${P1}`);
    r = await s.post(`/stream/${P1}/vote`, { csrf: csrfFor(boss), value: "1" }, boss, { Accept: "application/json" });
    assert.deepEqual(await r.json(), { score: 2, ups: 2, downs: 0, my_vote: 1 });
    r = await s.post(`/stream/${P1}/vote`, { csrf: csrfFor(boss), value: "-1" }, boss, { Accept: "application/json" });
    assert.deepEqual(await r.json(), { score: 0, ups: 1, downs: 1, my_vote: -1 });
    r = await s.post(`/stream/${P1}/vote`, { csrf: csrfFor(boss), value: "0" }, boss, { Accept: "application/json" });
    assert.deepEqual(await r.json(), { score: 1, ups: 1, downs: 0, my_vote: 0 });
    await s.post(`/stream/${P2}/vote`, { csrf: csrfFor(bob), value: "-1" }, bob);
    // Signed out, a stale form, another site: no vote counted.
    assert.equal((await s.post(`/stream/${P2}/vote`, { value: "1" }, null, { Accept: "application/json" })).status, 401);
    assert.equal((await s.post(`/stream/${P2}/vote`, { csrf: "stale", value: "1" }, ann)).status, 403);
    assert.equal((await s.post(`/stream/${P2}/vote`, { csrf: csrfFor(ann), value: "1" }, ann, { Origin: "https://evil.example" })).status, 403);
    assert.equal((await s.post(`/stream/${P2}/vote`, { csrf: csrfFor(ann), value: "5" }, ann)).status, 400);

    // For an app: items.json (search, tag, sort) and votes with a bearer token instead of cookie + CSRF.
    const tok = await (async () => { const st = await openAccounts(path.join(s.root, "rc.db")); const t = st.issueToken(ids[0], "app").token; st.close(); return t; })();
    const auth = { Authorization: `Bearer ${tok}` };
    let j = await (await fetch(`${s.base}/stream/items.json`)).json();
    assert.equal(j.account, null);
    assert.deepEqual(j.items.map((x) => x.title), ["Weather <b>now</b>", "My clock"]);
    assert.equal(j.items[0].my_vote, null, "no vote signed out");
    assert.equal(j.items[1].rc_url, `${s.base}/pages/${P1}/document.rc`);
    assert.equal(j.items[1].preview_url, `${s.base}/pages/${P1}/preview.png`);
    assert.deepEqual(j.items[1].document, { width: 320, height: 200 });
    assert.ok(j.tags.some((t) => t.tag === "clock"));
    j = await (await fetch(`${s.base}/stream/items.json?sort=top`)).json();
    assert.deepEqual(j.items.map((x) => [x.title, x.score]), [["My clock", 1], ["Weather <b>now</b>", -1]]);
    assert.deepEqual((await (await fetch(`${s.base}/stream/items.json?q=CLOCK`)).json()).items.map((x) => x.page_id), [P1]);
    assert.deepEqual((await (await fetch(`${s.base}/stream/items.json?q=ann+weather`)).json()).items.map((x) => x.page_id), [P2]);
    assert.deepEqual((await (await fetch(`${s.base}/stream/items.json?tag=time`)).json()).items.map((x) => x.page_id), [P1]);
    j = await (await fetch(`${s.base}/stream/items.json`, { headers: auth })).json();
    assert.equal(j.account.email, "ann@example.com");
    assert.equal(j.items[0].my_vote, 0);
    r = await fetch(`${s.base}/stream/${P2}/vote`, { method: "POST", headers: { ...auth, Accept: "application/json", "Content-Type": "application/x-www-form-urlencoded" }, body: "value=1" });
    assert.deepEqual(await r.json(), { score: 0, ups: 1, downs: 1, my_vote: 1 }, "no Origin, no CSRF: the token is enough");
    await fetch(`${s.base}/stream/${P2}/vote`, { method: "POST", headers: { ...auth, Accept: "application/json", "Content-Type": "application/x-www-form-urlencoded" }, body: "value=0" });
    r = await fetch(`${s.base}/stream/items.json`, { headers: { Authorization: "Bearer rc_wrong" } });
    assert.equal(r.status, 401, "a wrong token is refused, not taken as signed out");
    assert.equal((await fetch(`${s.base}/stream/${P2}/vote`, { method: "POST", headers: { Authorization: "Bearer rc_wrong", Accept: "application/json" }, body: "value=1" })).status, 401);

    // An app posts, renames, retags and takes out its own pages with the token.
    const appPost = (id, form, t = tok) => fetch(`${s.base}/stream/${id}/${form ? "post" : "remove"}`, { method: "POST",
        headers: { Authorization: `Bearer ${t}`, Accept: "application/json", "Content-Type": "application/x-www-form-urlencoded" }, body: new URLSearchParams(form ?? {}) });
    r = await appPost(P1, { title: "My clock, renamed", tags: "clock, Time" });
    assert.equal(r.status, 200);
    assert.deepEqual((await r.json()).item.tags, ["clock", "time"]);
    r = await appPost(P1, { title: "My clock" });
    assert.deepEqual((await r.json()).item, { page_id: P1, title: "My clock", author: "Ann K", tags: ["clock", "time"], score: 1, ups: 1, downs: 0 }, "tags left out stay");
    r = await appPost(PB, { title: "Not mine" });
    assert.equal(r.status, 400);
    assert.match((await r.json()).error, /only post your own/);
    r = await fetch(`${s.base}/stream/${P2}/remove`, { method: "POST", headers: { Authorization: `Bearer ${tok}`, Accept: "application/json" } });
    assert.deepEqual(await r.json(), { removed: true });
    assert.ok(!(await (await fetch(`${s.base}/stream/items.json`)).json()).items.some((x) => x.page_id === P2));
    r = await appPost(P2, { title: "Weather <b>now</b>", tags: "" });
    assert.equal(r.status, 200, "posted again");
    // Someone else's item: refused. A first post from an account with no name sets one.
    const carol = await reg("carol@example.com");
    const carolTok = await (async () => { const st = await openAccounts(path.join(s.root, "rc.db")); const id = st.findAccount("carol@example.com").id; st.close(); await publish(s, id, "d".repeat(22), "Carol's"); const st2 = await openAccounts(path.join(s.root, "rc.db")); const t = st2.issueToken(id, "app").token; st2.close(); return t; })();
    assert.ok(carol);
    assert.equal((await fetch(`${s.base}/stream/${P1}/remove`, { method: "POST", headers: { Authorization: `Bearer ${carolTok}`, Accept: "application/json" } })).status, 403);
    r = await appPost("d".repeat(22), { title: "Carol's page" }, carolTok);
    assert.match((await r.json()).error, /Set your name first/);
    r = await appPost("d".repeat(22), { title: "Carol's page", name: "Carol" }, carolTok);
    assert.equal((await r.json()).item.author, "Carol");
    assert.equal((await fetch(`${s.base}/stream/${"d".repeat(22)}/remove`, { method: "POST", headers: { Authorization: `Bearer ${carolTok}`, Accept: "application/json" } })).status, 200);

    // Top: by score.
    page = await (await s.get("/stream/?sort=top", bob)).text();
    assert.ok(page.indexOf("My clock") < page.indexOf("Weather"), "highest score first");
    assert.match(page, /Top<\/a>/);
    assert.match(page, new RegExp(`id="s-${P1}"[\\s\\S]*?aria-pressed="true" aria-label="Vote up"`), "bob sees his up vote");
    assert.match(page, /You are <b>Bob<\/b> \(<a href="\.\.\/account\/#name">change<\/a>\)/);
    // Changing it: the stream shows the new name at once.
    assert.equal((await s.post("/account/name", { csrf: csrfFor(bob), name: "Robert" }, bob)).status, 303);
    assert.match(await (await s.get("/account/", bob)).text(), /<b>Robert<\/b>[^\n]*Change name/);
    await s.post("/account/name", { csrf: csrfFor(ann), name: "Ann Karenina" }, ann);
    assert.match(await (await s.get("/stream/")).text(), /by Ann Karenina/);

    // The account page shows the score and offers rename and remove.
    acctPage = await (await s.get("/account/", ann)).text();
    assert.match(acctPage, /in the stream<\/span> <span class="muted">score 1 \(\+1 \/ −0\)/);
    assert.match(acctPage, /Rename or tag in the stream/);

    // A stranger cannot remove an item; its owner can; an admin can remove any from the stream page.
    await s.post(`/account/stream/${P1}/remove`, { csrf: csrfFor(bob) }, bob);
    assert.match(await (await s.get("/stream/")).text(), /My clock/);
    assert.equal((await s.post(`/stream/${P2}/remove`, { csrf: csrfFor(bob) }, bob)).status, 403);
    assert.equal((await s.post(`/account/stream/${P1}/remove`, { csrf: csrfFor(ann) }, ann)).status, 303);
    assert.equal((await s.post(`/stream/${P2}/remove`, { csrf: csrfFor(boss) }, boss)).status, 303);
    assert.match(await (await s.get("/stream/")).text(), /Nothing in the stream yet/);
});

test("showcases: an admin marks a stream item; the Showcases page shows it first", async (t) => {
    const s = await start();
    t.after(() => s.stop());
    const reg = async (email, name) => sidOf(await s.post("/account/register", { email, name }));
    const ann = await reg("ann@example.com", "Ann"), boss = await reg("boss@example.com", "Boss");
    const st = await openAccounts(path.join(s.root, "rc.db"));
    const annId = st.findAccount("ann@example.com").id;
    st.close();
    const P = "f".repeat(22);
    await publish(s, annId, P, "Orbit");
    await s.post("/account/stream", { csrf: csrfFor(ann), page_id: P, title: "Orbits, live" }, ann);

    let show = await (await s.get("/showcases/")).text();
    assert.ok(!show.includes("Made with Kobento"), "nothing marked yet");
    assert.match(await (await s.get("/stream/", boss)).text(), /Make showcase<\/button>/);
    assert.ok(!(await (await s.get("/stream/", ann)).text()).includes("Make showcase"), "not offered to others");
    assert.equal((await s.post(`/stream/${P}/feature`, { csrf: csrfFor(ann), value: "1" }, ann)).status, 403);
    assert.equal((await s.post(`/stream/${P}/feature`, { csrf: csrfFor(boss), value: "1" }, boss)).status, 303);

    show = await (await s.get("/showcases/")).text();
    assert.match(show, /Made with Kobento/);
    assert.ok(show.indexOf("Orbits, live") < show.indexOf('<h2 class="cat">Showcases</h2>'), "before the catalog's");
    assert.match(show, /by Ann/);
    assert.match(show, new RegExp(`href="${s.base}/pages/${P}/"`));
    const stream = await (await s.get("/stream/", boss)).text();
    assert.match(stream, /class="star">Showcase/);
    assert.match(stream, /Unshowcase<\/button>/);

    await s.post(`/stream/${P}/feature`, { csrf: csrfFor(boss), value: "0" }, boss);
    assert.ok(!(await (await s.get("/showcases/")).text()).includes("Made with Kobento"));
    // Marked, then taken out of the stream by its owner: off the Showcases page too.
    await s.post(`/stream/${P}/feature`, { csrf: csrfFor(boss), value: "1" }, boss);
    await s.post(`/account/stream/${P}/remove`, { csrf: csrfFor(ann) }, ann);
    assert.ok(!(await (await s.get("/showcases/")).text()).includes("Made with Kobento"));
});
