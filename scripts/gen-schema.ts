// Writes the submit_ops tool schema (from the Zod schema in src/ops/schema.ts) for the Edge Function.
// Run: npm run gen:schema   (CI checks the file is up to date.)
import { writeFileSync } from 'node:fs';
import { toolInputSchema } from '../src/ops/schema.ts';

const out = 'supabase/functions/_shared/ops.schema.json';
writeFileSync(out, JSON.stringify(toolInputSchema(), null, 2) + '\n');
console.log(`Wrote ${out}`);
