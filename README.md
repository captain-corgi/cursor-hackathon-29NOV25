# AI Usage Monitor

A cross-platform menu bar application for monitoring AI tool usage statistics (Claude Code & Cursor).

![Platform](https://img.shields.io/badge/platform-Windows%20%7C%20macOS-blue)
![Electron](https://img.shields.io/badge/electron-28+-green)
![TypeScript](https://img.shields.io/badge/typescript-5.3+-blue)
![React](https://img.shields.io/badge/react-18+-61DAFB)

## Features

- **System Tray Integration**: Lives in your menu bar/system tray for quick access
- **Multi-Provider Support**: 
  - **Claude Code**: Reads usage from local JSONL files (`~/.config/claude/projects/`)
  - **Cursor**: Mock data provider for development
- **Real-time Dashboard**: View daily, weekly, and monthly usage statistics
- **Cost Tracking**: See your AI spending at a glance
- **Usage Alerts**: Get notified when daily costs exceed your threshold
- **Auto-refresh**: Configurable refresh intervals
- **Launch at Login**: Start automatically when you log in

## Screenshots

*Dashboard showing usage statistics and cost breakdown*

## Installation

### From Releases

Download the latest release for your platform:
- **Windows**: `.exe` installer
- **macOS**: `.dmg` file

### From Source

```bash
# Clone the repository
git clone https://github.com/your-username/ai-usage-monitor.git
cd ai-usage-monitor

# Install dependencies
npm install

# Run in development mode
npm run dev

# Build for production
npm run build

# Package for distribution
npm run dist
```

## Development

### Prerequisites

- Node.js 18+
- npm 9+

### Project Structure

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
│   ├── auto-launch.ts         # Launch at login
│   ├── notification-manager.ts # System notifications
│   └── providers/
│       ├── index.ts           # Provider registry
│       ├── types.ts           # Provider interfaces
│       ├── claude-code-provider.ts
│       └── cursor-mock-provider.ts
├── renderer/                  # React frontend
│   ├── dashboard/             # Dashboard window
│   ├── settings/              # Settings window
│   └── shared/                # Shared components
├── shared/                    # Shared types
│   └── types.ts
└── preload.ts                 # Preload script
```

### Commands

```bash
# Development
npm run dev          # Run in development mode

# Build
npm run build        # Build both main and renderer
npm run build:main   # Build main process only
npm run build:renderer # Build renderer only

# Package
npm run pack         # Package without installer (for testing)
npm run dist         # Build and create installers
npm run dist:win     # Build for Windows only
npm run dist:mac     # Build for macOS only
```

## Configuration

Settings are stored in:
- **macOS**: `~/Library/Application Support/AIUsageMonitor/settings.json`
- **Windows**: `%APPDATA%/AIUsageMonitor/settings.json`

### Available Settings

| Setting | Description | Default |
|---------|-------------|---------|
| `refreshIntervalSeconds` | Data refresh interval | 60 |
| `displayFormat` | Tooltip display format (`cost` or `tokens`) | `cost` |
| `usageAlertEnabled` | Enable high usage alerts | `false` |
| `usageAlertThreshold` | Daily cost threshold for alerts | $10 |
| `launchAtLogin` | Start app at system login | `false` |
| `enabledProviders` | List of enabled providers | `['claude-code', 'cursor']` |

## Data Sources

### Claude Code

The app reads Claude Code usage data from JSONL files in:
- `~/.config/claude/projects/{project}/{session}.jsonl`
- `~/.claude/projects/{project}/{session}.jsonl`

Each line contains a JSON object with:
```json
{
  "timestamp": "2025-01-15T10:30:00Z",
  "model": "claude-sonnet-4-20250514",
  "usage": {
    "input_tokens": 1500,
    "output_tokens": 800,
    "cache_creation_input_tokens": 500,
    "cache_read_input_tokens": 200
  },
  "costUSD": 0.015,
  "sessionId": "abc123"
}
```

### Cursor (Mock)

The Cursor provider currently uses mock data for development purposes. Real API integration can be added in the future.

## Adding New Providers

1. Create a new provider file in `src/main/providers/`
2. Implement the `UsageProvider` interface
3. Register the provider in `src/main/providers/index.ts`

Example:
```typescript
import { UsageProvider } from './types';
import { NormalizedEntry, ModelPricing } from '../../shared/types';

export class MyProvider implements UsageProvider {
  id = 'my-provider';
  name = 'My Provider';
  type: 'file' | 'api' | 'mock' = 'api';

  async loadUsageData(): Promise<NormalizedEntry[]> {
    // Fetch and normalize data
    return [];
  }

  // ... implement other required methods
}
```

## License

MIT License - see [LICENSE](LICENSE) for details.

## Contributing

Contributions are welcome! Please feel free to submit a Pull Request.

1. Fork the repository
2. Create your feature branch (`git checkout -b feature/amazing-feature`)
3. Commit your changes (`git commit -m 'Add some amazing feature'`)
4. Push to the branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request
