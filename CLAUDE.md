# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

AI Usage Monitor is a cross-platform Electron menu bar application that tracks AI tool usage statistics for Claude Code and Cursor. The application displays real-time usage data, cost tracking, and provides alerts when usage exceeds configurable thresholds.

## Development Commands

```bash
# Development
npm run dev              # Run in development mode (builds main + starts renderer dev server + starts electron)
npm run dev:renderer     # Start Vite dev server for React renderer only
npm run watch:main       # Watch and compile main process TypeScript

# Building
npm run build            # Build both main and renderer processes
npm run build:main       # Build main process only (TypeScript compilation)
npm run build:renderer   # Build renderer process only (Vite build)

# Running
npm run start            # Start built application
npm run start:electron   # Start electron with wait-on for dev server

# Distribution
npm run pack             # Package without installer (for testing)
npm run dist             # Build and create installers for all platforms
npm run dist:win         # Build for Windows only (.exe + portable)
npm run dist:mac         # Build for macOS only (.dmg + .zip)
```

## Architecture Overview

### Main Process Architecture (`src/main/`)

The main process follows a modular architecture with clear separation of concerns:

- **`index.ts`**: Application entry point and lifecycle management
- **`app-state.ts`**: Centralized state management for usage data, aggregations, and high-usage detection
- **`tray-manager.ts`**: System tray icon, context menu, and tooltip management
- **`data-loader.ts`**: Orchestration of data loading from multiple providers
- **`cache-manager.ts`**: Atomic data caching with corruption handling
- **`settings-manager.ts`**: Platform-appropriate settings persistence
- **`ipc-handler.ts`**: Inter-process communication with renderer
- **`cost-calculator.ts`**: Token-based cost calculations with pricing models
- **`auto-launch.ts`**: Platform-specific launch-at-login functionality
- **`notification-manager.ts`**: Native system notifications

### Provider System (`src/main/providers/`)

The provider system enables pluggable data sources:

- **`types.ts`**: `UsageProvider` interface and common types
- **`index.ts`**: Provider registry and management
- **`claude-code-provider.ts`**: File-based provider reading from Claude Code JSONL files
- **`cursor-mock-provider.ts`**: Mock provider for development and testing

Provider types: `'file'` | `'api'` | `'mock'`

### Renderer Process (`src/renderer/`)

React-based UI with TypeScript:

- **`main.tsx`**: React app entry point
- **`App.tsx`**: Root component with routing
- **`dashboard/`**: Main dashboard with usage statistics and charts
- **`settings/`**: Settings interface for configuration
- **`shared/`**: Shared React components and Electron API type definitions

### Shared Types (`src/shared/`)

Common types and constants shared between main and renderer processes:

- **`types.ts`**: Core interfaces (`NormalizedEntry`, `AggregatedUsage`, `AppSettings`, etc.)
- **IPC_CHANNELS**: Constants for IPC channel names

## Key Technical Details

### Data Flow

1. **File Watching**: Uses `chokidar` to monitor Claude Code JSONL files in real-time
2. **Data Loading**: Provider system loads and normalizes data from multiple sources
3. **Caching**: Atomic file-based caching prevents data loss and improves performance
4. **Aggregation**: Real-time calculation of daily/weekly/monthly usage statistics
5. **IPC Communication**: Secure context-bridge pattern for main-renderer communication

### File Paths (Development vs Production)

- **Development**: `__dirname` is `dist/main/main/`, renderer source is at `src/renderer/`
- **Production**: `__dirname` is `dist/main/main/`, renderer build is at `dist/renderer/`

### Claude Code Data Sources

Monitors JSONL files in these locations:
- `~/.config/claude/projects/{project}/{session}.jsonl`
- `~/.claude/projects/{project}/{session}.jsonl`

Each line contains usage data with timestamps, model info, token counts, and costs.

### Settings Storage

Platform-appropriate locations:
- **macOS**: `~/Library/Application Support/AIUsageMonitor/settings.json`
- **Windows**: `%APPDATA%/AIUsageMonitor/settings.json`

## Electron Configuration

- **Main Process Config**: `tsconfig.main.json`
- **Renderer Process Config**: `tsconfig.renderer.json`
- **Vite Config**: `vite.config.ts` with React plugin and path aliases
- **Build Config**: Electron Builder configuration in `package.json`

### Path Aliases

- `@shared`: Points to `src/shared/`
- `@renderer`: Points to `src/renderer/`

## Adding New Providers

1. Create provider class in `src/main/providers/` implementing `UsageProvider`
2. Register in `src/main/providers/index.ts`
3. Add to default enabled providers in `src/shared/types.ts`

Provider interface requires:
- `id`, `name`, `type` properties
- `loadUsageData()`, `isAvailable()`, `testConnection()` methods

## Testing Strategy

- Use cursor-mock-provider for UI testing with different data scenarios
- Test file watching by creating/modifying JSONL files in Claude Code directories
- Verify settings persistence across app restarts
- Test cross-platform compatibility (Windows/macOS)

## Important Implementation Notes

- The app is designed as a menu bar application (not a traditional desktop app)
- Main window minimizes to tray instead of closing
- No dock icon on macOS (hidden via `app.dock.hide()`)
- Uses atomic file writes to prevent cache corruption
- Graceful error handling for provider failures
- Real-time data updates via file system watching