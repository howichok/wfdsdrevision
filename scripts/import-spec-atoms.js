#!/usr/bin/env node
/**
 * Import gathered spec atoms into PostgreSQL.
 *
 * Usage:
 *   npm run spec:gather          # merge scratch JSON first
 *   npm run spec:import          # migrate + import (local)
 *   dotenv -e .env.local -- node scripts/import-spec-atoms.js
 *
 * Options:
 *   --file=data/spec/t-level-dsd-spec-atoms.v1.json
 *   --skip-migrate               # only import (tables must exist)
 */

const fs = require("fs");
const path = require("path");
const { Pool } = require("pg");
const { execSync } = require("child_process");

const ROOT = path.join(__dirname, "..");
const DEFAULT_BUNDLE = path.join(ROOT, "data", "spec", "t-level-dsd-spec-atoms.v1.json");
const SPEC_MIGRATION = path.join(
  ROOT,
  "src",
  "lib",
  "db",
  "migrations",
  "0006_previous_mystique.sql"
);

function slugify(value) {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 80);
}

function parseArgs(argv) {
  const args = { file: DEFAULT_BUNDLE, skipMigrate: false };
  for (const arg of argv) {
    if (arg.startsWith("--file=")) args.file = path.resolve(arg.slice(7));
    if (arg === "--skip-migrate") args.skipMigrate = true;
  }
  return args;
}

async function ensureSpecTables(pool) {
  const check = await pool.query(`
    SELECT EXISTS (
      SELECT 1 FROM information_schema.tables
      WHERE table_schema = 'public' AND table_name = 'spec_pathways'
    ) AS ready
  `);
  if (check.rows[0]?.ready) return;

  if (!fs.existsSync(SPEC_MIGRATION)) {
    throw new Error(`Spec migration missing: ${SPEC_MIGRATION}`);
  }

  console.log("→ Applying spec schema migration (0006)…");
  const sql = fs.readFileSync(SPEC_MIGRATION, "utf8");
  const statements = sql
    .split("--> statement-breakpoint")
    .map((statement) => statement.trim())
    .filter(Boolean);

  for (const statement of statements) {
    try {
      await pool.query(statement);
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      if (!message.includes("already exists")) throw error;
    }
  }
}

function loadBundle(filePath) {
  if (!fs.existsSync(filePath)) {
    throw new Error(`Spec bundle not found: ${filePath}\nRun: npm run spec:gather`);
  }
  return JSON.parse(fs.readFileSync(filePath, "utf8"));
}

async function upsertPathway(client, bundle) {
  const slug = slugify(bundle.meta.pathwayAlias || bundle.meta.pathway);
  const existing = await client.query(`SELECT id FROM spec_pathways WHERE slug = $1`, [slug]);

  if (existing.rowCount > 0) {
    const pathwayId = existing.rows[0].id;
    await client.query(
      `UPDATE spec_pathways
       SET name = $2, alias = $3, spec_version = $4, structure = $5, meta = $6, updated_at = NOW()
       WHERE id = $1`,
      [
        pathwayId,
        bundle.meta.pathway,
        bundle.meta.pathwayAlias ?? null,
        bundle.meta.specVersion,
        JSON.stringify(bundle.structure),
        JSON.stringify(bundle.meta),
      ]
    );
    return pathwayId;
  }

  const inserted = await client.query(
    `INSERT INTO spec_pathways (slug, name, alias, spec_version, structure, meta)
     VALUES ($1, $2, $3, $4, $5, $6)
     RETURNING id`,
    [
      slug,
      bundle.meta.pathway,
      bundle.meta.pathwayAlias ?? null,
      bundle.meta.specVersion,
      JSON.stringify(bundle.structure),
      JSON.stringify(bundle.meta),
    ]
  );
  return inserted.rows[0].id;
}

async function clearPathwayData(client, pathwayId) {
  await client.query(`DELETE FROM spec_atom_edges WHERE pathway_id = $1`, [pathwayId]);
  await client.query(`DELETE FROM spec_atoms WHERE pathway_id = $1`, [pathwayId]);
}

async function insertAtoms(client, pathwayId, atoms) {
  const idByExternal = new Map();

  for (const atom of atoms) {
    const result = await client.query(
      `INSERT INTO spec_atoms (
        pathway_id, external_id, legacy_id, component_slug, module_slug,
        learning_outcome_id, atom_kind, title, statement, keywords,
        bloom_level, assessment_criteria, prerequisites, evidence_types,
        source_refs, metadata, needs_human_review
      ) VALUES (
        $1, $2, $3, $4, $5,
        $6, $7, $8, $9, $10,
        $11, $12, $13, $14,
        $15, $16, $17
      )
      RETURNING id, external_id`,
      [
        pathwayId,
        atom.id,
        atom.legacyId ?? null,
        atom.componentSlug,
        atom.moduleSlug,
        atom.learningOutcomeId ?? null,
        atom.atomKind ?? "knowledge",
        atom.title,
        atom.statement,
        JSON.stringify(atom.keywords ?? []),
        atom.bloomLevel ?? null,
        JSON.stringify(atom.assessmentCriteria ?? {}),
        JSON.stringify(atom.prerequisites ?? []),
        JSON.stringify(atom.evidenceTypes ?? []),
        JSON.stringify(atom.sourceRefs ?? []),
        atom.metadata ? JSON.stringify(atom.metadata) : null,
        Boolean(atom.needsHumanReview),
      ]
    );
    idByExternal.set(result.rows[0].external_id, result.rows[0].id);
  }

  return idByExternal;
}

async function insertEdges(client, pathwayId, bundle, idByExternal) {
  let edgeCount = 0;

  for (const edge of bundle.edges ?? []) {
    const fromId = idByExternal.get(edge.from);
    const toId = idByExternal.get(edge.to);
    if (!fromId || !toId) continue;
    await client.query(
      `INSERT INTO spec_atom_edges (pathway_id, from_atom_id, to_atom_id, edge_type)
       VALUES ($1, $2, $3, $4)`,
      [pathwayId, fromId, toId, edge.type ?? "prerequisite"]
    );
    edgeCount += 1;
  }

  for (const atom of bundle.atoms) {
    const toId = idByExternal.get(atom.id);
    if (!toId || !Array.isArray(atom.prerequisites) || atom.prerequisites.length === 0) continue;

    for (const prerequisite of atom.prerequisites) {
      const fromId =
        idByExternal.get(prerequisite) ||
        idByExternal.get(
          [...idByExternal.keys()].find(
            (key) => key.endsWith(String(prerequisite).replace(/^ATOM-/, "")) || key.includes(prerequisite)
          )
        );
      if (!fromId || fromId === toId) continue;

      await client.query(
        `INSERT INTO spec_atom_edges (pathway_id, from_atom_id, to_atom_id, edge_type)
         VALUES ($1, $2, $3, 'prerequisite')`,
        [pathwayId, fromId, toId]
      );
      edgeCount += 1;
    }
  }

  return edgeCount;
}

async function main() {
  const args = parseArgs(process.argv.slice(2));

  if (!process.env.DATABASE_URL) {
    console.error("DATABASE_URL is not set.");
    process.exit(1);
  }

  const bundle = loadBundle(args.file);
  const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: process.env.DATABASE_URL.includes("supabase.com")
      ? { rejectUnauthorized: false }
      : undefined,
  });

  if (!args.skipMigrate) {
    if (process.argv.includes("--drizzle-migrate")) {
      console.log("→ Running drizzle migrations…");
      execSync("npm run db:migrate", { stdio: "inherit", cwd: ROOT, env: process.env });
    } else {
      await ensureSpecTables(pool);
    }
  }

  const client = await pool.connect();

  try {
    await client.query("BEGIN");

    const pathwayId = await upsertPathway(client, bundle);
    console.log(`→ Pathway ready (${pathwayId})`);

    await clearPathwayData(client, pathwayId);
    console.log("→ Cleared previous spec atoms for pathway");

    const idByExternal = await insertAtoms(client, pathwayId, bundle.atoms);
    console.log(`→ Inserted ${idByExternal.size} spec atoms`);

    const edgeCount = await insertEdges(client, pathwayId, bundle, idByExternal);
    console.log(`→ Inserted ${edgeCount} prerequisite edges`);

    await client.query("COMMIT");

    const reviewFlags = bundle.atoms.filter((atom) => atom.needsHumanReview).length;
    console.log("\n✓ Spec import complete");
    console.log(`  pathway: ${bundle.meta.pathway}`);
    console.log(`  atoms: ${bundle.atoms.length}`);
    console.log(`  review flags: ${reviewFlags}`);
    console.log(`  bundle: ${path.relative(ROOT, args.file)}`);
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
    await pool.end();
  }
}

main().catch((error) => {
  console.error("Spec import failed:", error.message || error);
  process.exit(1);
});
