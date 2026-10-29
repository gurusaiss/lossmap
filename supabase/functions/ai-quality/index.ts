import { parseQualityResult, QUALITY_PROMPT, QUALITY_SCHEMA } from '../_shared/core/index.ts';
import { aiEndpoint } from '../_shared/aiEndpoint.ts';
Deno.serve(aiEndpoint('quality', QUALITY_PROMPT, QUALITY_SCHEMA, parseQualityResult));
