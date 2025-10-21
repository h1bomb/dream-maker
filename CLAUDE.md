# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

Dream Maker is an AI Agent Platform built with Next.js 15, TypeScript, and the Anthropic Claude Code SDK. It provides a web-based chat interface for interacting with Claude with configurable conversation turns.

## Development Commands

```bash
# Development
npm run dev        # Start development server with Turbo mode
npm run typecheck  # TypeScript type checking (run before commits)
npm run lint       # ESLint code checking

# Production
npm run build      # Build for production
npm run start      # Start production server
```

**Important**: Always run `npm run typecheck` and `npm run lint` before making commits.

## Architecture Overview

### Core Technologies
- **Frontend**: Next.js 15 with App Router, TypeScript, Tailwind CSS
- **UI Components**: shadcn/ui (New York variant) with Radix UI primitives
- **AI Integration**: Anthropic Claude Agent SDK (via adapter; falls back to Claude Code SDK if unavailable)
- **Styling**: CSS variables with dark mode support

### Key Directories
```
src/
├── app/                    # Next.js App Router
│   ├── api/chat/          # Claude API endpoint
│   ├── globals.css        # CSS variables and Tailwind base
│   └── layout.tsx         # Root layout with Inter font
├── components/
│   ├── chat/              # Chat interface components
│   └── ui/                # shadcn/ui components
└── lib/
    ├── claude.ts          # Claude SDK wrapper
    └── utils.ts           # cn() utility for class merging
```

## Agent SDK Integration

### Key Pattern
The app uses a wrapper pattern around the Anthropic Agent SDK via an internal adapter:

1. **ClaudeClient** (`src/lib/claude.ts`): Wraps the SDK's `query()` function
2. **Adapter** (`src/lib/agent-sdk.ts`): Prefers `@anthropic-ai/claude-agent-sdk`, falls back to `@anthropic-ai/claude-code`
3. **API Route** (`src/app/api/chat/route.ts`): Handles HTTP requests to Claude
4. **Chat Interface**: Processes SDK messages and manages UI state

### SDK Usage Pattern
```typescript
// Core pattern used throughout the app
import { query, type SDKMessage } from "@/lib/agent-sdk";

for await (const message of query({
  prompt,
  abortController,
  options: { maxTurns },
})) {
  messages.push(message);
}
```

### Message Flow
1. User input → ChatInterface component
2. HTTP POST → `/api/chat` endpoint
3. ClaudeClient → Agent SDK query() via adapter
4. SDKMessage[] array returned and processed
5. UI updated with parsed message content

## Component Architecture

### ChatInterface Component
**Location**: `src/components/chat/chat-interface.tsx`

**Key Features**:
- Configurable `maxTurns` (1-10) for multi-turn conversations
- Real-time message streaming with loading states
- Settings panel for configuration
- Keyboard shortcuts: Enter to send, Shift+Enter for newlines

**State Management**:
- `messages`: Array of conversation history
- `maxTurns`: Controls SDK conversation length
- `isLoading`: API call state
- `showSettings`: Settings panel visibility

### UI Component System
All components use shadcn/ui patterns:
- CSS variables for consistent theming
- `cn()` utility for conditional classes
- TypeScript interfaces for all props
- Radix UI primitives for accessibility

## Configuration Files

### TypeScript (`tsconfig.json`)
- Strict mode enabled
- Path aliases: `@/*` maps to `./src/*`
- ES2017 target for top-level await support
- Next.js plugin integration

### Tailwind (`tailwind.config.ts`)
- CSS variables for theming (light/dark mode)
- shadcn/ui color system
- Custom animations and radius variables
- Responsive breakpoints configured

### shadcn/ui (`components.json`)
- New York style variant
- CSS variables enabled
- Components path: `@/components`
- Utils path: `@/lib/utils`

## Environment Setup

### Required Variables
The Anthropic Agent SDK handles authentication automatically, so no API keys are required in environment variables.

### Optional Variables (`.env.example`)
```
NEXT_PUBLIC_APP_NAME=Dream Maker
NEXT_PUBLIC_APP_DESCRIPTION=AI Agent Platform powered by Claude Agent SDK
```

## Development Patterns

### Adding New UI Components
```bash
npx shadcn@latest add [component-name]
```
Components are automatically configured with the project's theming system.

### API Route Pattern
All API routes follow this structure:
1. Validate request body
2. Instantiate ClaudeClient
3. Process with error handling
4. Return structured JSON response

### Message Processing
The Claude Code SDK returns an array of different message types. The app processes them with this pattern:

```typescript
// SDK returns messages with types: 'system', 'assistant', 'result'
const assistantMsg = sdkMessages.find((msg: any) => msg.type === 'assistant');

let content = '';
if (assistantMsg && assistantMsg.message && assistantMsg.message.content) {
  if (Array.isArray(assistantMsg.message.content)) {
    content = assistantMsg.message.content
      .map((c: any) => c.text || c.toString())
      .join('\n');
  } else {
    content = assistantMsg.message.content.toString();
  }
}

// Fallback to 'result' type if no assistant message found
if (!content) {
  const resultMsg = sdkMessages.find((msg: any) => msg.type === 'result');
  if (resultMsg && resultMsg.result) {
    content = resultMsg.result;
  }
}
```

**Important**: Always look for `type === 'assistant'` messages first, then fall back to `type === 'result'` messages.

### Error Handling Patterns
- All API calls include try-catch blocks with user-friendly error messages
- Loading states are managed through `isLoading` state
- Network errors display fallback messages to users
- Invalid API responses are handled gracefully

## Build and Deployment

### Build Process
- Next.js optimizes for static and server-side rendering
- CSS is processed through PostCSS with Tailwind and Autoprefixer
- TypeScript compilation with strict type checking
- Production build generates optimized bundles

### Dependencies
- **Core**: Next.js 15, React 19, TypeScript 5
- **SDK**: Anthropic Agent SDK (adapter prefers `@anthropic-ai/claude-agent-sdk`, falls back to `@anthropic-ai/claude-code`)
- **UI**: shadcn/ui components with Radix UI primitives
- **Styling**: Tailwind CSS with class-variance-authority

### Performance Considerations
- Turbo mode enabled for faster development
- CSS variables for efficient theming
- Component-level code splitting
- Optimized font loading with next/font

## Common Development Tasks

### Adding New Features
1. Create components in `src/components/` following existing patterns
2. Use shadcn/ui components for consistency
3. Implement proper TypeScript interfaces
4. Test with different `maxTurns` configurations
5. Run `npm run typecheck` and `npm run lint` before committing

### Debugging Claude SDK Integration
- Check browser console for API response logs
- Verify message structure in `chat-interface.tsx:66`
- Ensure proper message type handling (`assistant` vs `result`)
- Test with different conversation lengths using `maxTurns`

### Styling Guidelines
- Use CSS variables defined in `globals.css`
- Follow shadcn/ui color system conventions
- Apply responsive design with Tailwind breakpoints
- Maintain dark mode compatibility