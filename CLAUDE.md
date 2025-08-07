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

Currently no test suite exists. When implementing tests, consider:
- Obsidian plugin testing patterns
- Mocking Obsidian API
- Testing Solid.js components

## Important Notes

- Target Obsidian version: 1.8.0+
- Uses Vercel AI SDK for model integrations
- Supports OpenAI, Anthropic, Google, and Perplexity providers
- CSS is in `src/styles.css` and gets copied to dist during build