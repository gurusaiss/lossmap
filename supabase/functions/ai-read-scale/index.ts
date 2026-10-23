import { parseScaleResult, SCALE_PROMPT, SCALE_SCHEMA } from '../_shared/core/index.ts';
import { aiEndpoint } from '../_shared/aiEndpoint.ts';
Deno.serve(aiEndpoint('scale', SCALE_PROMPT, SCALE_SCHEMA, parseScaleResult));
