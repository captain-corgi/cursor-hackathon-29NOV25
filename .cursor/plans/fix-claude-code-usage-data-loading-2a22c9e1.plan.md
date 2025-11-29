<!-- 2a22c9e1-ec4c-45fe-8ae5-fec805c244cb cc40b438-d54a-4505-85bb-2c29811020d7 -->
# Fix Claude Code Usage Data Loading

## Problem

The application fails to load Claude Code usage data because the `RawClaudeEntry` interface and parsing logic don't match the actual Claude Code JSONL format.

## Root Cause

Claude Code stores conversation data with usage info nested inside a `message` object for assistant-type entries:

```json
{
  "type": "assistant",
  "timestamp": "...",
  "message": {
    "model": "claude-sonnet-4-20250514",
    "usage": { "input_tokens": 1000, "output_tokens": 500, ... }
  }
}
```

Your current code expects a flat structure with `usage` at the root level.

## Changes Required

### 1. Update `RawClaudeEntry` in `src/main/providers/types.ts`

Replace with the correct Claude Code format (nested message structure):

```typescript
export interface RawClaudeEntry {
  type: string;
  timestamp: string;
  sessionId?: string;
  uuid?: string;
  message: {
    model: string;
    role: string;
    usage?: {
      input_tokens: number;
      output_tokens: number;
      cache_creation_input_tokens?: number;
      cache_read_input_tokens?: number;
    };
  };
  costUSD?: number;
}
```

### 2. Update `normalizeEntry` in `src/main/providers/claude-code-provider.ts`

Modify to use the correct nested structure:

```typescript
private normalizeEntry(raw: RawClaudeEntry, filePath: string): NormalizedEntry | null {
  // Only assistant messages have usage data
  if (!raw.message?.usage) return null;

  const usage = raw.message.usage;
  const model = raw.message.model || 'unknown';
  
  // ... rest of normalization
}
```

### 3. Update `parseFile` method

Change return type to handle null entries and filter them out:

```typescript
async parseFile(filePath: string): Promise<NormalizedEntry[]> {
  // ... parsing logic
  const normalized = this.normalizeEntry(raw, filePath);
  if (normalized) {
    entries.push(normalized);
  }
}
```

## Reference

Based on working implementation in `D:\Workspace\GolangWorkspace\win-cumon\src\main\providers\claude-code-provider.ts`

### To-dos

- [ ] Update RawClaudeEntry interface in types.ts to support nested message.usage format
- [ ] Modify normalizeEntry in claude-code-provider.ts to extract usage from message?.usage or usage
- [ ] Update parseFile to filter out null entries (non-usage entries like user messages)