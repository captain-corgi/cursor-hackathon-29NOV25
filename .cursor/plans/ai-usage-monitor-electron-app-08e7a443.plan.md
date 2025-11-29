<!-- 08e7a443-5daf-46f3-94ec-3be8ebf41a09 489805cc-e366-48ba-801b-4f848a843dd4 -->
# AI Usage Monitor - Electron Menu Bar Application

## Project Structure

```
src/
├── main/                      # Electron main process
│   ├── index.ts               # Entry point
│   ├── tray-manager.ts        # System tray handling
│   ├── app-state.ts           # State management
│   ├── data-loader.ts         # Data orchestration
│   ├── cost-calculator.ts     # Cost calculations
│   ├── settings-manager.ts    # Settings persistence
│   ├── cache-manager.ts       # Data caching
│   ├── ipc-handler.ts         # IPC communication
│   └── providers/
│       ├── index.ts           # Provider registry
│       ├── types.ts           # Provider interfaces
│       ├── claude-code-provider.ts
│       └── cursor-mock-provider.ts
├── renderer/                  # Electron renderer (React)
│   ├── dashboard/             # Dashboard window
│   ├── settings/              # Settings window
│   └── shared/                # Shared components
├── shared/                    # Shared types & utils
│   └── types.ts
└── preload.ts                 # Preload script for IPC
```

---

## Sprint 1: Skeleton Application (MVP)

**Goal**: Working Electron app with system tray icon showing dummy text.

### Tasks

1. **Initialize Electron + TypeScript project**

   - Create `package.json` with Electron 28+, TypeScript, electron-builder
   - Configure `tsconfig.json` for main/renderer separation
   - Setup electron-builder config for Windows/macOS

2. **Create basic main process** (`src/main/index.ts`)

   - Initialize Electron app
   - Create system tray with static icon
   - Show dummy tooltip: "AI Usage: $0.00 today"

3. **Implement basic tray context menu**

   - "Open Dashboard" (shows placeholder window)
   - "Refresh" (no-op for now)
   - "Settings" (shows placeholder window)
   - "Quit"

4. **Create placeholder windows**

   - Dashboard: Simple HTML showing "Dashboard - Coming Soon"
   - Settings: Simple HTML showing "Settings - Coming Soon"

---

## Sprint 2: React UI Foundation

**Goal**: Replace placeholder windows with React-based UI structure.

### Tasks

1. **Setup React 18 + Vite for renderer**

   - Configure Vite for Electron renderer
   - Setup React with TypeScript

2. **Create Dashboard UI skeleton**

   - Header with app title
   - Usage summary cards (with dummy data)
   - Provider breakdown section
   - Model breakdown section

3. **Create Settings UI skeleton**

   - Refresh interval input
   - Display format toggle (cost/tokens)
   - Usage threshold alert settings
   - Launch at login toggle
   - Provider enable/disable toggles

4. **Setup IPC communication**

   - Preload script with context bridge
   - Basic IPC channels for dashboard/settings data

---

## Sprint 3: Provider Architecture

**Goal**: Implement provider registry and mock data providers.

### Tasks

1. **Define shared types** (`src/shared/types.ts`)

   - `NormalizedEntry`, `AggregatedUsage`, `AppSettings`, `ModelPricing`

2. **Create Provider Registry** (`src/main/providers/index.ts`)

   - `UsageProvider` interface
   - Register/get/enable/disable providers

3. **Implement Cursor Mock Provider**

   - Return configurable mock data (hobby/pro/proPlus/ultra)
   - Support different plan types for testing UI

4. **Implement basic Data Loader**

   - Load data from all enabled providers
   - Filter by date range

---

## Sprint 4: Claude Code Provider

**Goal**: Implement file-based Claude Code provider.

### Tasks

1. **Create Claude Code Provider**

   - Detect platform-specific data directories
   - Parse JSONL files line by line
   - Handle malformed entries gracefully
   - Normalize entries to common format

2. **Implement file watching** (using `chokidar`)

   - Watch data directories for new files
   - Trigger data reload on changes

3. **Add cost calculation**

   - Calculate cost from tokens using pricing
   - Use pre-calculated costUSD when available

---

## Sprint 5: State Management & Cache

**Goal**: Implement app state management and data caching.

### Tasks

1. **Create App State Manager**

   - Centralized state for usage data
   - Daily/weekly/monthly aggregations
   - High usage detection

2. **Implement Settings Manager**

   - Persist settings to JSON file
   - Platform-appropriate app data directory

3. **Implement Cache Manager**

   - Cache aggregated usage data
   - Atomic file writes
   - Handle cache corruption

4. **Auto-refresh implementation**

   - Configurable refresh interval
   - Refresh timer management

---

## Sprint 6: Full Dashboard Implementation

**Goal**: Connect dashboard UI to real data.

### Tasks

1. **Wire up IPC for dashboard**

   - Send usage data to renderer
   - Handle time period selection
   - Provider filtering

2. **Implement dashboard features**

   - Daily/weekly/monthly summaries with real data
   - Per-model breakdown charts
   - Per-provider breakdown
   - Cost formatting ($X.XX)

3. **Stale data indicator**

   - Show last updated timestamp
   - Visual indicator for stale data

---

## Sprint 7: Settings & System Integration

**Goal**: Full settings functionality and OS integration.

### Tasks

1. **Complete settings implementation**

   - Save/load all settings
   - Apply settings changes immediately

2. **Launch at login**

   - macOS: auto-launch implementation
   - Windows: Registry/Startup folder

3. **Usage threshold alerts**

   - Compare daily cost to threshold
   - Change tray icon on alert
   - Platform-native notifications

4. **Minimize to tray on close**

---

## Sprint 8: Polish & Packaging

**Goal**: Final polish and distribution builds.

### Tasks

1. **Error handling improvements**

   - User-friendly error messages
   - Graceful provider failures

2. **Performance optimization**

   - Fast startup with cached data
   - Efficient file processing

3. **Build configuration**

   - electron-builder for Windows (.exe)
   - electron-builder for macOS (.dmg)

4. **App icons**

   - Normal state icon
   - Alert state icon

---

## Key Files to Create First (Sprint 1)

```typescript
// package.json - dependencies
{
  "electron": "^28.0.0",
  "typescript": "^5.0.0",
  "electron-builder": "^24.0.0"
}

// src/main/index.ts - entry point
import { app, Tray, Menu } from 'electron';

// src/main/tray-manager.ts - tray handling
class TrayManager {
  private tray: Tray;
  // Context menu, tooltip updates
}
```

---

## References

- Requirements: `docs/requirements.md`
- Design: `docs/design.md`
- Provider types: `NormalizedEntry`, `UsageProvider` interfaces

### To-dos

- [ ] Sprint 1: Initialize Electron + TypeScript project with package.json, tsconfig.json, and electron-builder config
- [ ] Sprint 1: Create basic main process with system tray icon showing dummy tooltip
- [ ] Sprint 1: Implement tray context menu and placeholder windows
- [ ] Sprint 2: Setup React 18 + Vite for renderer process
- [ ] Sprint 2: Create Dashboard UI skeleton with dummy data
- [ ] Sprint 2: Create Settings UI skeleton
- [ ] Sprint 3: Define shared types (NormalizedEntry, AppSettings, etc.)
- [ ] Sprint 3: Implement Provider Registry and Cursor Mock Provider
- [ ] Sprint 4: Implement Claude Code file-based provider with JSONL parsing
- [ ] Sprint 5: Implement App State Manager, Settings Manager, and Cache Manager
- [ ] Sprint 6: Wire dashboard UI to real data via IPC
- [ ] Sprint 7: Complete settings functionality and OS integration (launch at login, alerts)
- [ ] Sprint 8: Polish, error handling, and electron-builder packaging for Windows/macOS