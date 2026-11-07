// The stream: published pages their owners chose to show everyone, under a name and their
// account's name, with votes. Served by the examples site (lib/examples-web.mjs) at <base>/stream/:
//   GET  <base>/stream/[?sort=new|top][&tag=t]  the items (only those tagged t): preview, name,
//                                        poster, score, tags; a card opens the published page
//                                        (its playground). A bar lists the tags in use.
//   POST <base>/stream/<page id>/vote    value=1|-1|0 (0 takes the vote back); signed in, CSRF.
//                                        With Accept: application/json it answers the item's new
//                                        score instead of redirecting (the page's script uses it)
//   GET  <base>/stream/items.json[?sort=new|top][&tag=t][&q=words]  the same items as JSON, for an
//                                        app: each with its page, .rc and preview URLs, score and the
//                                        viewer's vote; q matches titles, authors and tags (all words).
//                                        Signed in by the session cookie or "Authorization: Bearer"
//                                        (an OAuth access token or an account token).
//                                        A vote may also carry the bearer token instead of the cookie
//                                        and CSRF field (a header no other site can make a browser send).
//   POST <base>/stream/<page id>/post    the page's owner (or an admin): post it, or rename and retag
//                                        it: title, tags ("a, b"; left out, they stay), and name, the
//                                        account's public name, set first when given (posting needs
//                                        one). JSON: {item} or {error}. For an app (bearer token).
//   POST <base>/stream/<page id>/remove  the item's owner or an admin: take it out (votes go too);
//                                        JSON with Accept: application/json
//   POST <base>/stream/<page id>/feature value=1|0: admins mark an item as a showcase, or not;
//                                        the Showcases page lists marked items (featuredSection)
// Posting, renaming and removing one's own items, and the account's name, are on the account page
// (lib/account-web.mjs). The data is in the accounts store (lib/accounts.mjs, schema 8; tags: 11).

import { readFileSync } from "node:fs";
import path from "node:path";
import { siteFooter } from "./privacy-web.mjs";
import { Accounts, accounts, accountsEnabled, bearerAccount, csrfFor, readCookie } from "./accounts.mjs";
import { esc, readForm, sameOrigin } from "./account-web.mjs";
import { formatBytes } from "./web-page.mjs";
import { workspaceRoot } from "./workspace.mjs";

const PAGE_ID = /^[A-Za-z0-9_-]{22}$/;

/** A published page's meta.json (pages/<id>/), or null when it is gone. */
function pageMeta(id) {
    const root = workspaceRoot();
    if (!root || !PAGE_ID.test(String(id))) return null;
    try { return JSON.parse(readFileSync(path.join(root, "pages", id, "meta.json"), "utf8")); } catch { return null; }
}

const STREAM_CSS = `
.sortbar { display:flex; gap:6px; align-items:center; margin:12px 0 4px; flex-wrap:wrap; }
.sortbar a { padding:6px 12px; border:1px solid var(--line); border-radius:999px; background:var(--card); color:var(--ink); text-decoration:none; font-size:13px; }
.sortbar a[aria-current] { background:var(--accent); border-color:var(--accent); color:#fff; }
.sortbar .note { color:var(--muted); font-size:13px; margin-left:auto; }
.sortbar .note a { padding:0; border:0; background:none; color:var(--accent); }
.sitem { display:flex; flex-direction:column; background:var(--card); border:1px solid var(--line); border-radius:12px; overflow:hidden; }
.sitem:hover, .sitem:focus-within { border-color:var(--accent); }
.sitem > a { color:inherit; text-decoration:none; display:flex; flex-direction:column; flex:1; }
.sitem .thumb { aspect-ratio:4/3; overflow:hidden; }
.sitem .thumb img { width:100%; height:100%; object-fit:contain; display:block; }
.sitem .by { color:var(--muted); font-size:13px; }
.sitem .meta { color:var(--muted); font-size:12px; font-variant-numeric:tabular-nums; }
.votes { display:flex; align-items:center; gap:6px; padding:8px 12px; border-top:1px solid var(--line); }
.votes form { margin:0; }
.votes button { width:32px; height:28px; border:1px solid var(--line); border-radius:8px; background:var(--bg); color:var(--muted); font:inherit; font-size:14px; line-height:1; cursor:pointer; }
.votes button:hover { border-color:var(--accent); color:var(--ink); }
.votes button[aria-pressed=true].up { background:color-mix(in srgb, #2e9d57 22%, transparent); border-color:#2e9d57; color:var(--ink); }
.votes button[aria-pressed=true].down { background:color-mix(in srgb, #d0453a 22%, transparent); border-color:#d0453a; color:var(--ink); }
.votes button:disabled { cursor:default; opacity:.5; }
.votes .score { min-width:2.5em; text-align:center; font-weight:700; font-variant-numeric:tabular-nums; }
.votes .split { color:var(--muted); font-size:12px; font-variant-numeric:tabular-nums; }
.votes .admin { margin-left:auto; display:flex; gap:4px; }
.votes .admin button { width:auto; padding:0 8px; font-size:12px; color:#d0453a; }
.votes .admin button.feature { color:var(--accent); }
.sitem .star { align-self:flex-start; font-size:11px; font-weight:700; letter-spacing:.03em; text-transform:uppercase; color:#b26b00; background:color-mix(in srgb, #f6a525 22%, transparent); border-radius:6px; padding:1px 6px; }
.lead { max-width:1280px; margin:0 auto; padding:4px 16px 8px; }
.lead h2 { font-size:16px; margin:8px 0 2px; }
.lead p { color:var(--muted); margin:0 0 10px; font-size:13px; }
.lead p a { color:var(--accent); text-decoration:none; }
.lead .grid { display:grid; gap:16px; grid-template-columns:repeat(auto-fill,minmax(240px,1fr)); }
.lead + main h2.cat { grid-column:1/-1; font-size:16px; margin:12px 0 0; }
.tagbar { display:flex; gap:4px 10px; flex-wrap:wrap; align-items:baseline; margin:6px 0 2px; font-size:13px; }
.tagbar .label { color:var(--muted); }
.tagbar a, .sitem .tags a { color:var(--accent); text-decoration:none; }
.tagbar a[aria-current] { font-weight:700; color:var(--ink); }
.tagbar .n { color:var(--muted); font-size:11px; margin-left:2px; font-variant-numeric:tabular-nums; }
.sitem .tags { display:flex; flex-wrap:wrap; gap:2px 8px; padding:0 12px 8px; font-size:12px; }
`;

/** The stream's query string for a sort and a tag ("" for the newest, untagged). */
const query = (sort, tag) => {
    const q = new URLSearchParams();
    if (sort === "top") q.set("sort", "top");
    if (tag) q.set("tag", tag);
    const s = q.toString();
    return s ? `?${s}` : "";
};

// Votes without a reload: the form posts as it would, asking for JSON back. (The forms work
// without the script too: the server then redirects back to the stream.)
const STREAM_SCRIPT = `
for (const form of document.querySelectorAll("form.vote")) form.addEventListener("submit", async (ev) => {
  ev.preventDefault();
  const item = form.closest(".sitem");
  const body = new URLSearchParams(new FormData(form, ev.submitter));
  try {
    const r = await fetch(form.action, { method: "POST", body, headers: { Accept: "application/json" }, credentials: "same-origin" });
    if (!r.ok) { location.reload(); return; }
    const s = await r.json();
    item.querySelector(".score").textContent = s.score;
    item.querySelector(".split").textContent = "+" + s.ups + " / −" + s.downs;
    for (const b of item.querySelectorAll("button[name=value]")) {
      const v = Number(b.dataset.v);
      b.setAttribute("aria-pressed", String(s.my_vote === v));
      b.value = s.my_vote === v ? "0" : String(v);
    }
  } catch { location.reload(); }
});
`;

const day = (iso) => String(iso ?? "").slice(0, 10);

function itemCard(it, { csrf, signedIn, admin, sort, tag }) {
    const qs = query(sort, tag);
    const m = it.meta;
    const preview = m.preview && it.url ? `<img src="${esc(it.url)}preview.png" alt="" loading="lazy">` : "<span>no preview</span>";
    const size = m.rc_bytes ? `${formatBytes(m.rc_bytes)} .rc` : "";
    const docSize = m.document?.width > 0 ? `${m.document.width}×${m.document.height}` : "";
    const btn = (v, cls, label, sign) => `<button class="${cls}" type="submit" name="value" data-v="${v}" value="${it.my_vote === v ? 0 : v}" aria-pressed="${it.my_vote === v}" aria-label="${label}"${signedIn ? "" : " disabled"}>${sign}</button>`;
    const vote = signedIn
        ? `<form class="vote" method="post" action="${esc(it.page_id)}/vote${qs}">${csrf}${btn(1, "up", "Vote up", "▲")}</form>
<span class="score">${it.score}</span>
<form class="vote" method="post" action="${esc(it.page_id)}/vote${qs}">${csrf}${btn(-1, "down", "Vote down", "▼")}</form>`
        : `${btn(1, "up", "Vote up (sign in to vote)", "▲")}<span class="score">${it.score}</span>${btn(-1, "down", "Vote down (sign in to vote)", "▼")}`;
    return `<article class="sitem" id="s-${esc(it.page_id)}">
<a href="${esc(it.url)}"><div class="thumb">${preview}</div>
<div class="body">${it.featured ? '<span class="star">Showcase</span>' : ""}<span class="title">${esc(it.title)}</span><span class="by">by ${esc(it.author)}</span>
<span class="meta">${[size, docSize, day(it.created)].filter(Boolean).map(esc).join(" · ")}</span></div></a>
${it.tags?.length ? `<div class="tags">${it.tags.map((t) => `<a href="./${query(sort, t)}">#${esc(t)}</a>`).join("")}</div>` : ""}
<div class="votes">${vote}<span class="split">+${it.ups} / −${it.downs}</span>
${admin ? `<div class="admin"><form method="post" action="${esc(it.page_id)}/feature${qs}">${csrf}<input type="hidden" name="value" value="${it.featured ? 0 : 1}"><button class="feature" type="submit" title="${it.featured ? "Take it off the Showcases page" : "Show it on the Showcases page"}">${it.featured ? "Unshowcase" : "Make showcase"}</button></form>
<form method="post" action="${esc(it.page_id)}/remove">${csrf}<button type="submit">Remove</button></form></div>` : ""}</div>
</article>`;
}

function streamPage({ site, items, sort, tag, tags, acct, sid, total }) {
    const csrf = sid ? `<input type="hidden" name="csrf" value="${csrfFor(sid)}">` : "";
    const sortLink = (k, label) => `<a href="./${query(k, tag)}"${sort === k ? ' aria-current="page"' : ""}>${label}</a>`;
    // The tags in use, the most used first; the one filtering, even when it is not among them.
    const shown = tag && !tags.some((t) => t.tag === tag) ? [{ tag, count: 0 }, ...tags] : tags;
    const tagBar = shown.length ? `<div class="tagbar"><span class="label">Tags:</span><a href="./${query(sort, null)}"${tag ? "" : ' aria-current="true"'}>all</a>${shown
        .map((t) => `<a href="./${query(sort, t.tag)}"${t.tag === tag ? ' aria-current="true"' : ""}>#${esc(t.tag)}<span class="n">${t.count || ""}</span></a>`).join("")}</div>` : "";
    const note = acct
        ? (acct.name ? `You are <b>${esc(acct.name)}</b> (<a href="../account/#name">change</a>) · <a href="../account/#pages">Post your pages</a>`
            : `<a href="../account/#name">Set your name</a> to post your pages`)
        : `<a href="../account/">Sign in</a> to vote and to post your pages`;
    const cards = items.map((it) => itemCard(it, { csrf, signedIn: !!acct, admin: !!acct?.admin, sort, tag })).join("\n");
    return `<!doctype html>
<html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1">
<title>Stream</title>${site.fonts ?? ""}<style>${site.css}${STREAM_CSS}</style></head>
<body>
<header>
<nav>${site.nav("stream")}</nav>
<h1>Stream</h1>
<p class="sub">Documents people made with Kobento and chose to share. Open one to play with it in the playground. To remix one, give its link to an agent connected to Kobento's MCP server: “Get &lt;link&gt; from Kobento and make it …”.${total ? ` ${total} item${total === 1 ? "" : "s"}${tag ? ` tagged #${esc(tag)}` : ""}.` : ""}</p>
<div class="sortbar">${sortLink("new", "Newest")}${sortLink("top", "Top")}<span class="note">${note}</span></div>
${tagBar}
</header>
<main>${cards || (tag ? `<p class="empty">Nothing tagged #${esc(tag)}. <a href="./${query(sort, null)}">Everything</a>.</p>`
    : `<p class="empty">Nothing in the stream yet. Publish a document with the publish tool, then post it from your account page.</p>`)}</main>
${siteFooter("../")}
<script>${STREAM_SCRIPT}</script>
</body></html>`;
}

const HEADERS = { "Cache-Control": "private, no-store", "X-Content-Type-Options": "nosniff", "Referrer-Policy": "same-origin" };

function reply(res, status, type, body, extra = {}) {
    const buf = Buffer.from(body);
    res.writeHead(status, { "Content-Type": type, "Content-Length": buf.length, ...HEADERS, ...extra });
    res.end(buf);
    return true;
}

/** True when it answered the request. site: {css, nav(current), fonts?}. */
export async function streamRoute(req, url, res, site) {
    const p = url.pathname;
    if (!/^\/stream(\/|$)/.test(p)) return false;
    if (!accountsEnabled()) return reply(res, 404, "text/plain", "The stream needs accounts, which are off on this server.\n");
    if (p === "/stream") { res.writeHead(301, { Location: `stream/${url.search}` }); res.end(); return true; }
    const store = await accounts();
    const sid = readCookie(req);
    // An app signs in with a bearer token; a wrong one is refused rather than taken as signed out.
    const bearer = /^Bearer\s/i.test(String(req.headers.authorization ?? ""));
    const viaBearer = bearer ? await bearerAccount(req) : null;
    if (bearer && !viaBearer?.account) {
        return reply(res, 401, "application/json", JSON.stringify({ error: viaBearer?.disabled ?? "invalid or expired token" }),
            { "WWW-Authenticate": 'Bearer realm="stream"' });
    }
    const acct = bearer ? viaBearer.account : sid ? store.sessionAccount(sid) : null;
    const sort = url.searchParams.get("sort") === "top" ? "top" : "new";
    const tag = url.searchParams.get("tag") ? Accounts.normalizeTags([url.searchParams.get("tag")])[0] ?? null : null;
    if (p === "/stream/items.json") {
        if (req.method !== "GET" && req.method !== "HEAD") { res.writeHead(405, { Allow: "GET, HEAD" }); res.end(); return true; }
        const words = String(url.searchParams.get("q") ?? "").toLowerCase().split(/\s+/).filter(Boolean).map((w) => w.replace(/^#/, ""));
        const items = store.streamItems({ sort, tag, viewerId: acct?.id ?? null, limit: 1000 })
            .filter((x) => words.every((w) => `${x.title} ${x.author} ${x.tags.join(" ")}`.toLowerCase().includes(w)))
            .map((it) => ({ ...it, meta: pageMeta(it.page_id) })).filter((it) => it.meta && it.url)
            .slice(0, 200)
            .map((it) => ({
                page_id: it.page_id, title: it.title, author: it.author, tags: it.tags, created: it.created,
                score: it.score, ups: it.ups, downs: it.downs, my_vote: acct ? it.my_vote : null, showcase: !!it.featured,
                url: it.url, rc_url: it.url + "document.rc", preview_url: it.meta.preview ? it.url + "preview.png" : null,
                rc_bytes: it.meta.rc_bytes ?? null, document: it.meta.document ?? null,
            }));
        return reply(res, 200, "application/json", JSON.stringify({
            account: acct ? { email: acct.email, name: acct.name ?? null } : null,
            sort, tag, tags: store.streamTags(), items,
        }), { Vary: "Authorization, Cookie" });
    }
    if (p === "/stream/") {
        if (req.method !== "GET" && req.method !== "HEAD") { res.writeHead(405, { Allow: "GET, HEAD" }); res.end(); return true; }
        const items = store.streamItems({ sort, tag, viewerId: acct?.id ?? null })
            .map((it) => ({ ...it, meta: pageMeta(it.page_id) })).filter((it) => it.meta && it.url);
        return reply(res, 200, "text/html; charset=utf-8", streamPage({ site, items, sort, tag, tags: store.streamTags(), acct, sid, total: items.length }));
    }
    const m = /^\/stream\/([A-Za-z0-9_-]{22})\/(vote|post|remove|feature)$/.exec(p);
    if (!m) return reply(res, 404, "text/plain", "not found\n");
    if (req.method !== "POST") { res.writeHead(405, { Allow: "POST" }); res.end(); return true; }
    const wantsJson = /application\/json/.test(String(req.headers.accept ?? ""));
    const back = (status = 303) => {
        res.writeHead(status, { Location: `../${query(sort, tag)}#s-${m[1]}`, ...HEADERS });
        res.end();
        return true;
    };
    if (!bearer && !sameOrigin(req)) return reply(res, 403, "text/plain", "Refused: this form must be sent from this site's own pages.\n");
    if (!acct) return wantsJson ? reply(res, 401, "application/json", JSON.stringify({ error: "sign in to vote" })) : back();
    let form;
    try { form = await readForm(req); } catch (e) { return reply(res, e.status ?? 400, "text/plain", "Bad request.\n"); }
    if (!bearer && form.get("csrf") !== csrfFor(sid)) return reply(res, 403, "text/plain", "Refused: the page is stale. Reload it and try again.\n");
    const json = (status, body) => reply(res, status, "application/json", JSON.stringify(body));
    if (m[2] === "post") {
        try {
            if (form.has("name") && String(form.get("name")).trim() !== (acct.name ?? "")) store.setName(acct.id, form.get("name"));
            const who = store.getAccount(acct.id) ?? acct;
            store.streamPost({ pageId: m[1], account: { ...who, admin: acct.admin }, title: form.get("title"), tags: form.has("tags") ? form.get("tags") : null });
        } catch (e) { return json(400, { error: e.message }); }
        const it = store.streamItem(m[1], acct.id);
        return json(200, { item: { page_id: it.page_id, title: it.title, author: it.author, tags: it.tags, score: it.score, ups: it.ups, downs: it.downs } });
    }
    if (m[2] === "remove") {
        const it = store.streamItem(m[1]);
        if (it && it.account_id !== acct.id && !acct.admin) return wantsJson ? json(403, { error: "not your item" }) : reply(res, 403, "text/plain", "Admins only.\n");
        if (it) store.streamRemove(m[1]);
        return wantsJson ? json(200, { removed: !!it }) : back();
    }
    if (m[2] === "feature") {
        if (!acct.admin) return reply(res, 403, "text/plain", "Admins only.\n");
        store.streamFeature(m[1], form.get("value") !== "0");
        return back();
    }
    let ok;
    try { ok = store.vote(m[1], acct.id, form.get("value")); } catch (e) { return reply(res, 400, "text/plain", e.message + "\n"); }
    if (!ok) return wantsJson ? reply(res, 404, "application/json", JSON.stringify({ error: "not in the stream" })) : back();
    if (wantsJson) {
        const it = store.streamItem(m[1], acct.id);
        return reply(res, 200, "application/json", JSON.stringify({ score: it.score, ups: it.ups, downs: it.downs, my_vote: it.my_vote }));
    }
    return back();
}

/**
 * The Showcases page's "Made with Kobento" section: the items an admin marked, as stream cards
 * without votes (a card opens the page's playground). Empty when there are none or accounts
 * are off. `base` is the way from the page to the site's root ("../").
 */
export async function featuredSection(base = "../") {
    if (!accountsEnabled()) return "";
    const store = await accounts();
    const items = store.featuredItems().map((it) => ({ ...it, meta: pageMeta(it.page_id) })).filter((it) => it.meta && it.url);
    if (!items.length) return "";
    const cards = items.map((it) => {
        const m = it.meta;
        const preview = m.preview ? `<img src="${esc(it.url)}preview.png" alt="" loading="lazy">` : "<span>no preview</span>";
        const facts = [m.rc_bytes ? `${formatBytes(m.rc_bytes)} .rc` : "", m.document?.width > 0 ? `${m.document.width}×${m.document.height}` : ""].filter(Boolean);
        return `<article class="sitem"><a href="${esc(it.url)}"><div class="thumb">${preview}</div>
<div class="body"><span class="title">${esc(it.title)}</span><span class="by">by ${esc(it.author)}</span>
<span class="meta">${facts.map(esc).join(" · ")}</span></div></a></article>`;
    }).join("\n");
    return `<section class="lead"><h2>Made with Kobento</h2>
<p>Pages built with Kobento's tools and picked for this page. More in the <a href="${base}stream/">stream</a>.</p>
<div class="grid">${cards}</div></section>`;
}

export { STREAM_CSS };
