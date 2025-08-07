# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

Co-Intelligence AI is an Obsidian plugin that integrates AI chat functionality directly into Obsidian. It uses Solid.js for the UI framework and TypeScript throughout.

## Development Commands

```bash
# Install dependencies
npm install

# Development mode with hot reload
npm run dev

# Production build
npm run build

# Run tests
npm test

# Run tests with UI
npm run test:ui

# Run tests once (CI mode)
npm run test:run

# Run tests with coverage
npm run test:coverage
```

## Architecture

### Key Entry Points
- `src/CoIntelligencePlugin.tsx` - Main plugin class that extends Obsidian's Plugin
- `src/ChatView.tsx` - Custom Obsidian view for the chat interface
- `src/CoiChatApp.tsx` - Main Solid.js app component

### Core Services
- `src/services/modelRegistry.ts` - Singleton managing AI provider integrations
- `src/services/modelService.ts` - Handles AI model interactions and streaming

### Plugin Integration
The plugin uses `monkey-around` to patch Obsidian's `WorkspaceLeaf` to automatically open COI chat notes in the custom chat view. This happens in `src/CoIntelligencePlugin.tsx:139-171`.

### Chat Storage
Chats are stored as markdown files with special frontmatter:
- `is-coi-chat: true` - Identifies COI chat notes
- `coi-chat-view: "chat"|"source"` - Display mode
- Chat content is wrapped in `<!-- CHAT-THREAD-START -->` and `<!-- CHAT-THREAD-END -->` tags

### Build Configuration
- Uses Vite with `vite-plugin-solid` for Solid.js support
- Outputs CommonJS format for Obsidian compatibility
- Path aliases: `@/` → `src/`, `@assets/` → `assets/`

## Testing

The project uses Vitest for testing with the following infrastructure:

### Test Framework
- **Vitest** - Fast unit testing framework with Jest-compatible API
- **@solidjs/testing-library** - Testing utilities for Solid.js components
- **jsdom** - DOM environment for testing
- **Coverage** - V8 coverage provider with text, JSON, and HTML reports

### Test Configuration
- Tests run in jsdom environment with global APIs enabled
- Setup file at `test/setup.ts` configures mocks and polyfills
- Obsidian API is mocked via alias in `vitest.config.ts`
- String.prototype.contains polyfill for Obsidian compatibility

### Testing Guidelines for Claude Code
- **Always run tests before making changes**: `npm run test:run`
- **Write tests for new functionality** in `src/**/__tests__/` directories
- **Run tests after implementation** to verify functionality
- **Check TypeScript errors**: Use `npm run build` to validate types
- **Use coverage reports** to ensure adequate test coverage

### Test Location Patterns
- Unit tests: `src/**/__tests__/*.test.ts`
- Test utilities: `test/utils/`
- Mock implementations: `test/mocks/`

## Important Notes

- Target Obsidian version: 1.8.0+
- Uses Vercel AI SDK for model integrations
- Supports OpenAI, Anthropic, Google, and Perplexity providers
- CSS is in `src/styles.css` and gets copied to dist during build