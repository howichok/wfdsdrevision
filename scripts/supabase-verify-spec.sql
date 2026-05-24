-- Quick checks after running supabase-spec-atoms-only.sql + npm run spec:import:only

-- Tables exist?
SELECT table_name
FROM information_schema.tables
WHERE table_schema = 'public'
  AND table_name IN (
    'spec_pathways',
    'spec_atoms',
    'spec_atom_edges',
    'evidence_atom_links'
  )
ORDER BY 1;

-- Row counts (atoms = 0 until you import)
SELECT
  (SELECT COUNT(*) FROM spec_pathways) AS pathways,
  (SELECT COUNT(*) FROM spec_atoms) AS atoms,
  (SELECT COUNT(*) FROM spec_atom_edges) AS edges,
  (SELECT COUNT(*) FROM evidence_atom_links) AS evidence_links;

-- Atoms by component (expect 89 + 89 + 30 = 208 after import)
SELECT component_slug, COUNT(*) AS n
FROM spec_atoms
GROUP BY 1
ORDER BY 1;

-- Sample atoms
SELECT external_id, title, module_slug, needs_human_review
FROM spec_atoms
ORDER BY external_id
LIMIT 10;
