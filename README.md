# Dream Maker

An AI Agent Platform powered by Claude Code SDK, built with Next.js, TypeScript, and shadcn/ui.

## Features

- 🤖 Claude Code SDK Integration
- 💬 Real-time Chat Interface
- 🎨 Modern UI with shadcn/ui
- ⚡ Built with Next.js and TypeScript
- 🔄 Multi-turn Conversations
- ⚙️ Configurable Max Turns

## Getting Started

### Prerequisites

- Node.js 18+ 
- npm or yarn
- Claude Code SDK access

### Installation

1. Clone the repository:
```bash
git clone <your-repo-url>
cd dream-maker
```

2. Install dependencies:
```bash
npm install
```

3. Set up environment variables (optional):
```bash
cp .env.example .env.local
```

Note: This project uses Claude Code SDK which handles authentication automatically.

4. Run the development server:
```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) with your browser to see the result.

## Usage

1. Click the settings icon to configure max turns (1-10)
2. Start chatting with Claude through the interface
3. Use Shift+Enter for new lines, Enter to send messages
4. Claude can take multiple turns in a conversation based on your settings

## Tech Stack

- **Framework**: Next.js 15
- **Language**: TypeScript
- **Styling**: Tailwind CSS
- **UI Components**: shadcn/ui
- **AI SDK**: Anthropic Claude Code SDK
- **Icons**: Lucide React

## Development

```bash
# Run development server
npm run dev

# Build for production
npm run build

# Start production server
npm start

# Lint code
npm run lint

# Type check
npm run typecheck
```

## License

MIT