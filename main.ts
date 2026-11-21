// Port Solano — the entry program (Node 22, standard library only).
//
// It hands the game in: it copies this repository's game/ (the playable open world,
// plain static files) and screenshots/ (four JPEG renders of the game itself) into the
// output directory, then writes /output/dossier.json with the vendored make.fun
// library, buildDossier from vendor/makefun-game.ts. The grader runs it twice and
// both runs must write the same bytes; copying files and building the dossier from
// them is deterministic, so they do.
//
// Outside the grader, MAKEFUN_OUTPUT_DIR stands in for /output:
//   mkdir -p out && MAKEFUN_OUTPUT_DIR=out node main.ts
//
// No permissions are changed anywhere: files the program writes already come out
// world-readable, which is all the grader needs.

import { cpSync, existsSync, mkdirSync, rmSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { buildDossier } from './vendor/makefun-game.ts';

// The repository root: the directory this file lives in.
const repoRoot = fileURLToPath(new URL('.', import.meta.url));

// The grader hands us /output; locally MAKEFUN_OUTPUT_DIR stands in for it.
const outDir = process.env.MAKEFUN_OUTPUT_DIR ?? '/output';

// Copy the game and its screenshots in. mkdirSync with recursive:true creates the
// output directory (and any parents) when it is missing, and leaves it alone when
// it already exists. Any game/ or screenshots/ left in the output directory from an
// earlier run is removed first, so a stale file can never survive into the dossier.
mkdirSync(outDir, { recursive: true });
rmSync(join(outDir, 'game'), { recursive: true, force: true });
rmSync(join(outDir, 'screenshots'), { recursive: true, force: true });
cpSync(join(repoRoot, 'game'), join(outDir, 'game'), { recursive: true });
mkdirSync(join(outDir, 'screenshots'), { recursive: true });
if (existsSync(join(repoRoot, 'screenshots'))) {
  cpSync(join(repoRoot, 'screenshots'), join(outDir, 'screenshots'), { recursive: true });
}

// Write the dossier the judge reads, with the same caps the gate scores against:
// the text is capped at 160 KiB, at most 4 screenshots of 256 KiB each, game/ at
// most 993 entries and 48 MiB, every path at most 1000 bytes. buildDossier throws
// when the entry would fail those caps, so a bad entry fails loudly here instead
// of silently handing in an invalid dossier.
writeFileSync(
  join(outDir, 'dossier.json'),
  buildDossier(outDir, {
    text_max_bytes: 163840,
    screenshots: { max: 4, max_bytes: 262144 },
    game_max_files: 993,
    game_max_bytes: 50331648,
    game_path_max_bytes: 1000,
  }),
);
