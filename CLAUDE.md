# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

Co-Intelligence AI is an Obsidian plugin that integrates AI chat functionality directly into Obsidian. It uses Solid.js for the UI framework, TypeScript throughout, and the Vercel AI SDK for model integrations. It supports OpenAI, Anthropic, Google, and Perplexity providers.

## Development Commands

```bash
npm install          # Install dependencies
npm run dev          # Development mode with file watching
npm run build        # Production build (also validates TypeScript types)
npm test             # Run tests with Vitest
npm run test:run     # Run tests once (CI mode)
npm run test:ui      # Run tests with UI
npm run test:coverage # Run tests with V8 coverage
```

## Architecture

### Entry Points & Data Flow
1. `src/CoIntelligencePlugin.tsx` — Main plugin class. Registers the custom view, commands, ribbon icon, and monkey-patches `WorkspaceLeaf.setViewState()` (via `monkey-around`) to intercept markdown views for COI notes and redirect them to the chat view.
2. `src/ChatView.tsx` — Extends Obsidian's `TextFileView`. Manages chat state (messages, context, sources), handles serialization/deserialization of chat files, and renders the Solid.js app via `render()`. Uses debounced saves (500ms).
3. `src/CoiChatApp.tsx` — Root Solid.js component. Creates context providers (`PluginContext`, `AppContext`, `FileContext`) and renders `ChatInterface`.

### Core Services
- `src/services/model-registry.ts` — Singleton that manages AI provider initialization from settings API keys and tracks available models.
- `src/services/model-service.ts` — `generateChatResponse()` streams AI responses with provider-specific configs (OpenAI web search tool, Google search grounding, Anthropic headers). `generateChatTitle()` auto-renames chats using a configurable renaming model.

### Chat Storage Format
Chats are markdown files with frontmatter (`is-coi-chat: true`, `coi-chat-view`, `linked-notes`, `linked-tags`) and content between `<!-- CHAT-THREAD-START -->` / `<!-- CHAT-THREAD-END -->` markers. Messages use `## user:` and `## assistant:` headings. Serialization logic is in `src/utils/notes.ts`.

### Context System
`src/utils/model-context.ts` handles fetching content from linked notes/tags (`getContext()`), formatting it into prompts (`makeContext()`), and estimating token usage (`contextTokenEstimate()`).

### UI Components
`src/components/ChatInterface.tsx` is the main orchestrator (manages model, messages, context, sources, processing state). `src/components/UserInput.tsx` handles message input with `[[` note and `#` tag autocomplete via suggestion modals.

## Code Conventions (from .rules)

**This project uses Solid.js, NOT React.** This is the most important convention:
- Use `createSignal` and `createEffect` for state management
- Use `<For>` for looping, `<Show>` for conditional rendering
- Pass accessors (functions) to child components, not values
- Avoid refs; prefer signals and effects
- Prefer stateless components when possible

**Other conventions:**
- Use `@/` imports (maps to `src/`), not relative imports
- No inline styles — use CSS classes in `src/styles.css` with Obsidian CSS variables
- Use Lucide icons (from Obsidian), not emoji
- No NodeJS APIs — the plugin must work on Obsidian mobile
- Minimal comments — only for complex logic or function/class documentation
- Favor native HTML elements (e.g., `<dialog>` for modals, `<details>` for collapsibles)

## Testing

- Tests go in `src/**/__tests__/*.test.ts` directories
- Obsidian API is mocked via alias in `vitest.config.ts` pointing to `test/mocks/obsidian.ts`
- Uses jsdom environment with `@solidjs/testing-library` for component testing
- Run `npm run build` to validate TypeScript types
