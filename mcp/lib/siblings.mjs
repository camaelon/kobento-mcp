// The sibling repositories kobento-mcp runs against. They are expected next to this one
// (../kobento-ts, ../kobento-tools), or wherever KOBENTO_TS / KOBENTO_TOOLS point.
//
//   kobento-ts      the TypeScript player: the web bundle deploy pages embed, the inspector's engine
//   kobento-tools   json2rc (json2rc/build), rc2image and rc2layout (cpp/build), the inspector

import path from "node:path";
import { fileURLToPath } from "node:url";

/** This repository's root (kobento-mcp). */
export const REPO = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..", "..");
const PARENT = path.dirname(REPO);

export const KOBENTO_TS = path.resolve(process.env.KOBENTO_TS ?? path.join(PARENT, "kobento-ts"));
export const KOBENTO_TOOLS = path.resolve(process.env.KOBENTO_TOOLS ?? path.join(PARENT, "kobento-tools"));

/** The compiled json2rc converter (CommonJS: Parser.js, Header.js, cli.js). */
export const JSON2RC_BUILD = path.join(KOBENTO_TOOLS, "json2rc", "build");
/** The C++ tools' build tree (rc2image/rc2image, rc2layout/rc2layout). */
export const CPP_BUILD = path.join(KOBENTO_TOOLS, "cpp", "build");
export const INSPECTOR = path.join(KOBENTO_TOOLS, "inspector");
