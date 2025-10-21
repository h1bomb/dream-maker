/*
  Adapter for migrating from @anthropic-ai/claude-code to @anthropic-ai/claude-agent-sdk.
  - At runtime, it prefers the new Agent SDK if available, otherwise falls back to the Code SDK.
  - Downstream code should import query and SDKMessage from this adapter to avoid direct package coupling.
*/

import { createRequire } from 'module';

const require = createRequire(import.meta.url);

// Very loose typing to avoid breaking builds when either package is missing at install time.
export type SDKMessage = any;

export const isAgentSDK: boolean = (() => {
  try {
    require('@anthropic-ai/claude-agent-sdk');
    return true;
  } catch {
    return false;
  }
})();

// Resolve the actual query implementation from whichever SDK is present.
let _query: (args: any) => AsyncIterable<SDKMessage>;

try {
  // Prefer the new Agent SDK
  const mod = require('@anthropic-ai/claude-agent-sdk');
  _query = mod.query;
} catch {
  // Fallback to the legacy Code SDK
  const mod = require('@anthropic-ai/claude-code');
  _query = mod.query;
}

// Re-export a stable query API
export const query = (args: any): AsyncIterable<SDKMessage> => _query(args);
