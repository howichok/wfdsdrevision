#!/usr/bin/env node
/**
 * Merge scratch atom JSON files into one canonical spec bundle.
 *
 * Usage: node scripts/gather-spec-atoms.js
 * Output: data/spec/t-level-dsd-spec-atoms.v1.json
 */

const fs = require("fs");
const path = require("path");

const ROOT = path.join(__dirname, "..");
const OUT_DIR = path.join(ROOT, "data", "spec");
const OUT_FILE = path.join(OUT_DIR, "t-level-dsd-spec-atoms.v1.json");

const SOURCES = {
  core: path.join(ROOT, "scratch", "core_atoms.json"),
  contentArea: path.join(ROOT, "scratch", "specialism_atoms.json"),
  assessment: path.join(ROOT, "scratch", "assessment_atoms.json"),
};

const PATHWAY =
  "T Level Digital Production, Design and Development";
const PATHWAY_ALIAS = "T Level Digital Software Development";

const CONTENT_AREA_SLUGS = {
  1: "problem_solving",
  2: "programming",
  3: "emerging_issues",
  4: "legislation",
  5: "business_context",
  6: "data",
  7: "digital_environments",
  8: "security",
};

function readJson(filePath) {
  if (!fs.existsSync(filePath)) {
    throw new Error(`Missing source file: ${filePath}`);
  }
  return JSON.parse(fs.readFileSync(filePath, "utf8"));
}

function titleFromStatement(statement) {
  const cleaned = statement
    .replace(/^Student can\s+/i, "")
    .replace(/\.$/, "")
    .trim();
  if (cleaned.length <= 96) return cleaned;
  return `${cleaned.slice(0, 93)}…`;
}

function normaliseBloomLevel(value) {
  return String(value ?? "understand").trim().toLowerCase();
}

function normaliseSourceRefs(sourceRefs) {
  if (!Array.isArray(sourceRefs)) return [];
  return sourceRefs.map((ref) => {
    if (typeof ref === "string") {
      const areaMatch = ref.match(/Content_Area_(\d+)_([^.:]+)/);
      if (areaMatch) {
        const areaNum = areaMatch[1];
        return {
          section: `Content area ${areaNum}`,
          moduleSlug: CONTENT_AREA_SLUGS[areaNum] ?? `content_area_${areaNum}`,
          excerpt: ref,
        };
      }
      return { excerpt: ref };
    }
    if (ref && typeof ref === "object") {
      return {
        section: ref.section ?? null,
        page: ref.page ?? null,
        excerpt: ref.excerpt ?? null,
      };
    }
    return { excerpt: String(ref) };
  });
}

function normaliseAssessmentCriteria(raw) {
  if (raw && typeof raw === "object" && !Array.isArray(raw)) {
    return {
      pass: raw.pass ?? null,
      merit: raw.merit ?? null,
      distinction: raw.distinction ?? null,
    };
  }
  if (typeof raw === "string" && raw.trim()) {
    const level = raw.trim().toLowerCase();
    return {
      pass: level === "pass" ? "Pass-tier expectation from source extraction." : null,
      merit: level === "merit" ? "Merit-tier expectation from source extraction." : null,
      distinction:
        level === "distinction" ? "Distinction-tier expectation from source extraction." : null,
    };
  }
  return { pass: null, merit: null, distinction: null };
}

function inferContentArea(sourceRefs) {
  for (const ref of normaliseSourceRefs(sourceRefs)) {
    const excerpt = ref.excerpt ?? "";
    const match = excerpt.match(/Content_Area_(\d+)_/);
    if (match) {
      const num = match[1];
      return {
        moduleSlug: CONTENT_AREA_SLUGS[num] ?? `content_area_${num}`,
        learningOutcomeId: `CA-${num}`,
      };
    }
  }
  return { moduleSlug: "unknown", learningOutcomeId: null };
}

function padSeq(value, width = 2) {
  return String(value).padStart(width, "0");
}

function normaliseCoreAtom(raw, index) {
  const lo = raw.learningOutcome ?? "unknown";
  const legacyId = raw.id ?? `ATOM-${lo}-${index + 1}`;
  const seq = legacyId.split("-").pop() ?? padSeq(index + 1);
  const id = `DSD-CORE-${String(lo).replace(/\./g, "-")}-${padSeq(seq)}`;

  return {
    id,
    legacyId,
    componentSlug: "core",
    moduleSlug: `lo_${String(lo).replace(/\./g, "_")}`,
    learningOutcomeId: lo,
    atomKind: "knowledge",
    title: titleFromStatement(raw.statement ?? legacyId),
    statement: raw.statement ?? "",
    keywords: Array.isArray(raw.keywords) ? raw.keywords : [],
    bloomLevel: normaliseBloomLevel(raw.bloomLevel),
    assessmentCriteria: normaliseAssessmentCriteria(raw.assessmentCriteria),
    prerequisites: Array.isArray(raw.prerequisites) ? raw.prerequisites : [],
    evidenceTypes: ["written_explanation"],
    sourceRefs: normaliseSourceRefs(raw.sourceRefs),
    needsHumanReview: false,
  };
}

function normaliseContentAreaAtom(raw, index) {
  const legacyId = raw.id ?? `ATOM-${padSeq(index + 1, 3)}`;
  const { moduleSlug, learningOutcomeId } = inferContentArea(raw.sourceRefs ?? []);
  const seq = legacyId.replace(/^ATOM-/, "");
  const id = `DSD-CA-${moduleSlug.toUpperCase().replace(/_/g, "-")}-${padSeq(seq, 3)}`;

  return {
    id,
    legacyId,
    componentSlug: "core_content_area",
    moduleSlug,
    learningOutcomeId,
    atomKind: "knowledge",
    title: titleFromStatement(raw.statement ?? legacyId),
    statement: raw.statement ?? "",
    keywords: Array.isArray(raw.keywords) ? raw.keywords : [],
    bloomLevel: normaliseBloomLevel(raw.bloomLevel),
    assessmentCriteria: normaliseAssessmentCriteria(raw.assessmentCriteria),
    prerequisites: [],
    evidenceTypes: ["written_explanation", "code"],
    sourceRefs: normaliseSourceRefs(raw.sourceRefs),
    needsHumanReview: moduleSlug === "unknown",
  };
}

function normaliseAssessmentAtom(raw, index) {
  const legacyId = raw.id ?? `asm-${padSeq(index + 1, 3)}`;
  const seq = legacyId.replace(/^asm-/, "");
  const id = `DSD-ASM-${padSeq(seq, 3)}`;
  const gradeLevel = raw.gradeLevel ?? null;

  return {
    id,
    legacyId,
    componentSlug: "assessment",
    moduleSlug: raw.moduleSlug ?? "exams",
    learningOutcomeId: raw.learningOutcomeId ?? null,
    atomKind: raw.type ?? "grade_boundary",
    title: raw.title ?? legacyId,
    statement: raw.description ?? raw.title ?? "",
    keywords: [raw.context, raw.type, raw.gradeLevel].filter(Boolean),
    bloomLevel: "apply",
    assessmentCriteria: {
      pass:
        gradeLevel === "Pass"
          ? raw.remedialAction ?? raw.description ?? null
          : null,
      merit:
        gradeLevel === "Merit"
          ? raw.remedialAction ?? raw.description ?? null
          : null,
      distinction:
        gradeLevel === "Distinction"
          ? raw.remedialAction ?? raw.description ?? null
          : null,
    },
    prerequisites: [],
    evidenceTypes: ["written_explanation"],
    sourceRefs: normaliseSourceRefs(raw.sourceRefs ?? []),
    metadata: {
      context: raw.context ?? null,
      remedialAction: raw.remedialAction ?? null,
      gradeLevel,
    },
    needsHumanReview: false,
  };
}

function buildStructure(atoms) {
  const components = new Map();

  for (const atom of atoms) {
    if (!components.has(atom.componentSlug)) {
      components.set(atom.componentSlug, {
        slug: atom.componentSlug,
        modules: new Map(),
      });
    }
    const component = components.get(atom.componentSlug);
    if (!component.modules.has(atom.moduleSlug)) {
      component.modules.set(atom.moduleSlug, {
        slug: atom.moduleSlug,
        learningOutcomes: new Set(),
        atomCount: 0,
      });
    }
    const module = component.modules.get(atom.moduleSlug);
    if (atom.learningOutcomeId) module.learningOutcomes.add(atom.learningOutcomeId);
    module.atomCount += 1;
  }

  return [...components.values()].map((component) => ({
    slug: component.slug,
    modules: [...component.modules.values()].map((module) => ({
      slug: module.slug,
      learningOutcomes: [...module.learningOutcomes].sort(),
      atomCount: module.atomCount,
    })),
  }));
}

function main() {
  const coreRaw = readJson(SOURCES.core);
  const contentAreaRaw = readJson(SOURCES.contentArea);
  const assessmentRaw = readJson(SOURCES.assessment);

  const atoms = [
    ...coreRaw.map(normaliseCoreAtom),
    ...contentAreaRaw.map(normaliseContentAreaAtom),
    ...assessmentRaw.map(normaliseAssessmentAtom),
  ];

  const ids = new Set();
  const duplicates = [];
  for (const atom of atoms) {
    if (ids.has(atom.id)) duplicates.push(atom.id);
    ids.add(atom.id);
  }

  const reviewFlags = atoms.filter((atom) => atom.needsHumanReview).length;

  const bundle = {
    meta: {
      pathway: PATHWAY,
      pathwayAlias: PATHWAY_ALIAS,
      specVersion: "core-student-book-v1",
      generatedAt: new Date().toISOString(),
      sourceFiles: {
        core: path.relative(ROOT, SOURCES.core),
        contentArea: path.relative(ROOT, SOURCES.contentArea),
        assessment: path.relative(ROOT, SOURCES.assessment),
      },
      atomCount: atoms.length,
      breakdown: {
        core: coreRaw.length,
        coreContentArea: contentAreaRaw.length,
        assessment: assessmentRaw.length,
      },
      reviewFlags,
      duplicateIds: duplicates,
    },
    structure: buildStructure(atoms),
    atoms,
    edges: [],
  };

  fs.mkdirSync(OUT_DIR, { recursive: true });
  fs.writeFileSync(OUT_FILE, `${JSON.stringify(bundle, null, 2)}\n`, "utf8");

  console.log(`Gathered ${atoms.length} atoms → ${path.relative(ROOT, OUT_FILE)}`);
  console.log(
    `  core=${coreRaw.length} content_area=${contentAreaRaw.length} assessment=${assessmentRaw.length}`
  );
  if (reviewFlags > 0) console.log(`  needsHumanReview=${reviewFlags}`);
  if (duplicates.length > 0) console.log(`  duplicateIds=${duplicates.length}`);
}

main();
