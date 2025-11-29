# Cross-Platform Menu Bar Application - Requirements Document

## Introduction

This document specifies the requirements for a cross-platform menu bar application (Windows + macOS) built with Electron that displays AI tool usage and balance information. The application runs in the system tray/menu bar, providing quick visibility into usage credits without needing to open the AI tools or navigate to account settings.

The application supports multiple AI tools using a pluggable provider architecture:
- **Claude Code**: File-based provider that reads usage data from local JSONL files
- **Cursor**: Mock data provider (API-based structure with mock data for development)

## Glossary

- **Menu Bar App**: An application that runs in the system status bar (macOS) or system tray (Windows)
- **System Tray**: The notification area in Windows taskbar where applications can display icons
- **Menu Bar**: The macOS system menu bar area where system icons and third-party app icons appear
- **Cursor**: An AI-powered code editor that uses credits/tokens for AI features
- **Claude Code**: An AI coding assistant that tracks usage via local JSONL files
- **JSONL**: JSON Lines format - a text format where each line is a valid JSON object containing usage data
- **Token**: A unit of text processing in AI models (input tokens are sent to the model, output tokens are generated)
- **Cache Tokens**: Tokens stored/retrieved from cache to optimize API usage (cache_creation_input_tokens and cache_read_input_tokens)
- **Balance**: The remaining credits or monetary value available in the user's AI tool account
- **Provider**: A module that handles data discovery and parsing for a specific AI tool
- **Session**: A single AI tool interaction session, stored as a file
- **Project**: A directory grouping multiple sessions
- **Electron**: Framework for building cross-platform desktop applications using web technologies

## Supported Providers

### Claude Code (File-Based Provider - Primary)

Claude Code stores usage data in local JSONL files. The provider reads and parses these files to calculate usage statistics.

**Data Locations:**
- Primary: `~/.config/claude/projects/{project}/{sessionId}.jsonl`
- Legacy: `~/.claude/projects/{project}/{sessionId}.jsonl`

**JSONL Entry Format:**
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

### Cursor (Mock Data Provider - Development)

Cursor provider uses mock data for development purposes. The API-based structure is in place but returns predefined mock responses until real API integration is implemented.

**Mock Data Types:**
- Hobby (Free)
- Pro ($20/mo)
- Pro+ ($60/mo)
- Ultra ($200/mo)
- Teams ($40/user/mo)
- Enterprise

## Requirements

### Requirement 1: System Tray/Menu Bar Display

**User Story:** As a developer, I want to see my AI tool usage at a glance in the system tray/menu bar, so that I can monitor my consumption without opening a separate window.

#### Acceptance Criteria

1. WHEN the application launches THEN the application SHALL display an icon in the system tray (Windows) or menu bar (macOS)
2. WHEN usage data is successfully loaded THEN the application SHALL display the current day's total cost in USD as a tooltip on the tray icon
3. WHEN the user hovers over the tray icon THEN the application SHALL show a tooltip with today's token count and cost (aggregated across all enabled providers)
4. WHEN the daily cost exceeds a configurable threshold THEN the application SHALL change the tray icon color to indicate high usage
5. WHEN the user right-clicks the tray icon THEN the application SHALL display a context menu with options to open dashboard, refresh data, open settings, and exit
6. WHILE the application is running THEN the application SHALL refresh usage data at a configurable interval (default: 60 seconds)
7. WHEN multiple AI tools are configured THEN the application SHALL display aggregated usage information in the tooltip

### Requirement 2: Claude Code File-Based Data Loading

**User Story:** As a developer, I want the application to automatically read my Claude Code usage data from local files, so that I can see accurate statistics without manual configuration.

#### Acceptance Criteria

1. WHEN the application starts THEN it SHALL search for Claude Code data in the default directories:
   - `~/.config/claude/projects/`
   - `~/.claude/projects/`
2. WHEN usage JSONL files are found THEN the application SHALL parse each file line by line as JSON
3. WHEN parsing usage data THEN the application SHALL extract and validate all token count fields as non-negative integers:
   - input_tokens
   - output_tokens
   - cache_creation_input_tokens
   - cache_read_input_tokens
4. WHEN the user configures a custom data directory THEN the application SHALL read data from the specified path(s)
5. WHEN new usage files are detected THEN the application SHALL include the new data in calculations
6. WHEN parsing data THEN the application SHALL serialize parsed data back to its original format without data loss (round-trip consistency)
7. WHEN multiple projects are found THEN the application SHALL aggregate data from all projects, tagging each entry with its source

### Requirement 3: Settings and Configuration

**User Story:** As a user, I want to configure the app's behavior, so that I can customize how and when usage information is displayed.

#### Acceptance Criteria

1. WHEN the user accesses settings THEN the application SHALL allow configuration of the refresh interval (minimum 1 minute, maximum 60 minutes)
2. WHEN the user accesses settings THEN the application SHALL allow toggling between showing usage as currency or token count
3. WHEN the user enables low balance alerts THEN the application SHALL display a visual warning when daily cost exceeds a user-defined threshold
4. WHEN settings are changed THEN the application SHALL persist the configuration across app restarts
5. WHEN the user enables "Launch at Login" THEN the application SHALL register itself to start automatically:
   - macOS: Using ServiceManagement framework or auto-launch package
   - Windows: Using Registry entries or Startup folder
6. WHEN the user disables "Launch at Login" THEN the application SHALL remove itself from startup items
7. WHEN the application starts and is configured to launch at login THEN it SHALL start minimized to the tray/menu bar without showing any windows
8. WHEN the user configures custom data directories THEN the application SHALL scan those directories in addition to default locations

### Requirement 4: Error Handling

**User Story:** As a user, I want the app to handle errors gracefully, so that I have a reliable experience.

#### Acceptance Criteria

1. WHEN a file read fails THEN the application SHALL log the error and continue with other available files
2. WHEN a JSONL line is malformed THEN the application SHALL skip that line and continue processing
3. WHEN the data directory is inaccessible THEN the application SHALL display a clear error and suggest checking permissions
4. WHEN displaying stale data THEN the application SHALL clearly indicate the data age (e.g., "Updated 2 hours ago")
5. IF parsing fails unexpectedly THEN the application SHALL log the error and display a generic error state without crashing
6. WHEN a provider fails to load THEN the application SHALL log the error and continue with other providers

### Requirement 5: Multi-Tool Support

**User Story:** As a developer, I want to monitor multiple AI tools in one place, so that I can track all my AI usage efficiently.

#### Acceptance Criteria

1. WHEN the application starts THEN it SHALL discover and load all configured AI tool providers
2. WHEN multiple tools are configured THEN the application SHALL aggregate and display data from all enabled tools
3. WHEN displaying tooltip information THEN the application SHALL show breakdown by tool or aggregated total based on user preference
4. WHEN a tool provider fails to load THEN the application SHALL log the error and continue with other providers
5. WHEN the user opens the dashboard THEN the application SHALL display per-tool breakdown with individual usage information
6. WHEN the Cursor provider is enabled THEN the application SHALL display mock data for development purposes

### Requirement 6: Data Parsing and Validation

**User Story:** As a developer, I want the usage data to be parsed correctly from JSONL files, so that accurate information is displayed.

#### Acceptance Criteria

1. WHEN reading a JSONL file THEN the application SHALL parse each line as a separate JSON object
2. WHEN parsing token values THEN the application SHALL handle both integer and decimal number formats
3. WHEN the file format is unexpected THEN the application SHALL detect the parsing failure and report a clear error
4. WHEN serializing usage data for local caching THEN the application SHALL encode the data as JSON
5. WHEN reading cached usage data THEN the application SHALL decode the JSON and reconstruct the usage object
6. WHEN parsing fails THEN the application SHALL fall back to cached data if available
7. WHEN validating parsed data THEN the application SHALL ensure all required fields are present and valid:
   - timestamp (ISO8601 format)
   - model (string)
   - usage.input_tokens (non-negative integer)
   - usage.output_tokens (non-negative integer)
8. WHEN optional fields are missing THEN the application SHALL use default values:
   - cache_creation_input_tokens: 0
   - cache_read_input_tokens: 0
   - costUSD: calculated from tokens if not present

### Requirement 7: Cost Calculations

**User Story:** As a developer, I want to see cost calculations based on current model pricing, so that I can accurately track my spending.

#### Acceptance Criteria

1. WHEN calculating costs THEN the application SHALL use the formula: `totalCost = (inputTokens * inputPrice) + (outputTokens * outputPrice) + (cacheCreateTokens * cacheCreatePrice) + (cacheReadTokens * cacheReadPrice)`
2. WHEN usage entries contain pre-calculated costUSD THEN the application SHALL use that value instead of calculating
3. WHEN displaying costs THEN the application SHALL format values as USD with two decimal places
4. WHEN aggregating costs THEN the application SHALL sum costs across all sessions, models, and providers for the selected time period
5. WHEN a provider has specific pricing THEN the application SHALL use that provider's pricing configuration

### Requirement 8: Caching and Offline Support

**User Story:** As a user, I want the app to cache processed data, so that startup is fast and I can see usage even if files are temporarily unavailable.

#### Acceptance Criteria

1. WHEN usage data is successfully processed THEN the application SHALL cache the aggregated data locally
2. WHEN the application starts THEN it SHALL load cached data immediately for fast display
3. WHEN displaying cached data THEN the application SHALL indicate that the data may be stale
4. WHEN cache data becomes corrupted THEN the application SHALL clear the cache and reprocess source files
5. WHEN the cache file is missing THEN the application SHALL treat it as a non-error condition and proceed normally
6. WHEN saving cache data THEN the application SHALL use atomic writes to prevent corruption

### Requirement 9: Platform-Specific Features

**User Story:** As a user, I want the app to integrate seamlessly with my operating system, so that it feels native and works reliably.

#### Acceptance Criteria

1. WHEN running on macOS THEN the application SHALL search for Claude Code data in:
   - `~/.config/claude/projects/`
   - `~/.claude/projects/`
2. WHEN running on Windows THEN the application SHALL search for Claude Code data in:
   - `%USERPROFILE%\.config\claude\projects\`
   - `%USERPROFILE%\.claude\projects\`
3. WHEN displaying notifications THEN the application SHALL use platform-native notification APIs
4. WHEN the application is closed THEN it SHALL minimize to tray/menu bar instead of exiting (unless explicitly quit)
5. WHEN the user double-clicks the tray icon THEN the application SHALL open or focus the dashboard window
6. WHEN the application starts THEN it SHALL detect the platform and use appropriate file paths
7. WHEN storing application data THEN it SHALL use platform-appropriate directories:
   - macOS: `~/Library/Application Support/AppName/`
   - Windows: `%APPDATA%/AppName/`

### Requirement 10: Dashboard Window

**User Story:** As a user, I want to view detailed usage statistics in a dashboard window, so that I can analyze my AI tool consumption patterns.

#### Acceptance Criteria

1. WHEN the user opens the dashboard THEN the application SHALL display daily, weekly, and monthly usage summaries
2. WHEN displaying usage data THEN the application SHALL show:
   - Input tokens
   - Output tokens
   - Cache creation tokens
   - Cache read tokens
   - Total tokens
   - Cost in USD
3. WHEN the user selects a time period THEN the application SHALL filter and display usage data for that period
4. WHEN displaying model breakdown THEN the application SHALL show per-model token counts and costs
5. WHEN the dashboard loads THEN the application SHALL display the most recent data first
6. WHEN displaying provider breakdown THEN the application SHALL show per-provider token counts and costs
7. WHEN the user selects a provider filter THEN the application SHALL display usage data only from the selected provider(s)
8. WHEN the dashboard window is closed THEN the application SHALL minimize to tray/menu bar instead of exiting

### Requirement 11: Usage Threshold Alerts

**User Story:** As a user, I want to be notified when my usage exceeds expected levels, so that I can control my spending.

#### Acceptance Criteria

1. WHEN usage alerts are enabled THEN the application SHALL check daily cost against the configured threshold
2. WHEN daily cost exceeds threshold THEN the application SHALL change the tray icon appearance to indicate alert state
3. WHEN daily cost exceeds threshold THEN the application SHALL display a platform-native notification
4. WHEN the threshold is configured as a dollar amount THEN the application SHALL compare against calculated daily cost
5. WHEN the user sets a daily cost threshold THEN the application SHALL store the threshold value persistently

## Technical Requirements

### Platform Support

- **macOS**: 10.15 (Catalina) or later
- **Windows**: Windows 10 or later

### Technology Stack

- **Runtime**: Electron 28+
- **Language**: TypeScript
- **UI Framework**: React 18+ (for dashboard) or native HTML/CSS
- **File Watching**: chokidar or fs.watch for detecting new JSONL files
- **Auto Launch**: auto-launch package or platform-specific implementations
- **Build Tool**: Electron Builder or Electron Forge

### Performance Requirements

- **Startup Time**: Application should start and display tray icon within 2 seconds
- **Memory Usage**: Should not exceed 100MB under normal operation
- **CPU Usage**: Should remain below 1% when idle
- **File Processing**: Should process 10,000 JSONL entries within 1 second

### Data Validation Properties

1. **Token Count Non-Negativity**: All token counts must be non-negative integers
2. **Cost Calculation Formula**: Cost = (input * inputPrice) + (output * outputPrice) + (cacheCreate * cacheCreatePrice) + (cacheRead * cacheReadPrice)
3. **Pre-calculated Cost Preference**: Use costUSD if present, otherwise calculate
4. **Round-Trip Consistency**: Parse → Serialize → Parse should produce equivalent data
5. **Time Period Filtering**: Filtered results contain only entries within selected period
6. **Provider Tagging**: Each entry must be tagged with its source provider

### Accessibility Requirements

1. Tray icon tooltip MUST be readable by screen readers
2. Dashboard UI MUST support keyboard navigation
3. Color indicators MUST have alternative text or icons
4. Error messages MUST be clear and actionable

## Non-Functional Requirements

### Reliability

- Application should handle file system errors gracefully
- Application should recover from crashes without data loss
- Cache should be resilient to corruption
- Provider failures should not affect other providers

### Maintainability

- Code should follow TypeScript best practices
- Components should be modular and testable
- Error handling should be comprehensive
- Provider interface should be extensible

### Usability

- Setup process should require minimal configuration
- Error messages should be user-friendly
- Settings should be discoverable and intuitive
- Data should be visible within seconds of launch

### Scalability

- Architecture should support adding new AI tool providers easily
- Data models should be extensible
- File processing should handle thousands of entries efficiently

## References

- macOS Implementation: `stats-app/CursorBalance/`
- Original Requirements: `docs/requirements.md`
- Original Design: `docs/design.md`
- Electron Documentation: https://www.electronjs.org/docs
