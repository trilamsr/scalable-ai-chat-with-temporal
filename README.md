# Scalable AI Chat Application

A production-ready, horizontally scalable real-time chat application with AI integration, built with modern technologies and enterprise-grade patterns.

## Features

- **Real-time Communication**: WebSocket-based chat using Socket.IO with Redis adapter for horizontal scaling
- **AI Integration**: Integrated AI chat capabilities powered by OpenAI with streaming responses
- **Multi-Room Support**: Multiple isolated chat rooms with independent conversations
- **Durable Workflows**: AI streaming implemented as durable Temporal workflows for reliability
- **Message Persistence**: Redis Streams-based chat history with efficient retrieval
- **Rate Limiting**: Built-in rate limiting per user and event type
- **Type Safety**: Full end-to-end TypeScript with shared types across frontend and backend
- **Production Ready**: Comprehensive error handling, logging, and graceful shutdown

## Technology Stack

### Frontend
- **React 18** with TypeScript
- **Vite** for fast development and optimized builds
- **TailwindCSS** for styling
- **Socket.IO Client** for real-time communication

### Backend
- **Node.js** with TypeScript
- **Express** for HTTP server
- **Socket.IO** for WebSocket connections with Redis adapter
- **Redis** for pub/sub, message persistence, and rate limiting
- **Temporal** for durable AI workflow orchestration
- **OpenAI** (via Vercel AI SDK) for AI chat capabilities
- **Pino** for structured logging

### Shared
- **Monorepo structure** with shared types and utilities
- **Zod** for runtime type validation

## Prerequisites

- Node.js 18+ and npm
- Docker and Docker Compose
- OpenAI API key

## Installation & Setup

1. **Clone the repository**
   ```bash
   git clone <repository-url>
   cd scalable-ai-chat-app
   ```

2. **Install dependencies**
   ```bash
   npm install
   ```

3. **Set up environment variables**

   Create a `.env` file in the `root`/`backend` directory:
   ```bash
   OPENAI_API_KEY=your_openai_api_key_here
   ```
   Further customization can be found at /shared/src/constants.ts

4. **Start infrastructure services**
   ```bash
   make reset-dev
   ```
5. **Access the application**
   - Frontend: http://localhost:3000
   - Backend: http://localhost:4000
   - Health check: http://localhost:4000/health
   - Temporal UI: http://localhost:8233

## Project Structure

```
scalable-ai-chat-app/
├── backend/              # Backend server
│   ├── src/
│   │   ├── handlers/     # Socket event handlers
│   │   ├── services/     # Business logic services
│   │   ├── temporal/     # Temporal workflows & activities
│   │   ├── utils/        # Utility functions
│   │   ├── server.ts     # Main server entry point
│   │   └── socket.ts     # Socket.IO configuration
│   └── package.json
├── frontend/             # React frontend
│   ├── src/
│   │   ├── components/   # React components
│   │   ├── hooks/        # Custom React hooks
│   │   └── utils/        # Frontend utilities
│   └── package.json
├── shared/               # Shared types and utilities
│   ├── src/
│   │   ├── types/        # TypeScript type definitions
│   │   ├── validation/   # Zod schemas
│   │   └── logger.ts     # Logging configuration
│   └── package.json
└── docker-compose.yml    # Infrastructure services
└── docker-compose.dev.yml# DEV Infrastructure services
```

## High-Level Architecture

```
┌────────────────────────────────────────────────────────────────┐
│                         Frontend Layer                         │
│  ┌──────────────┐   ┌──────────────┐   ┌──────────────┐        │
│  │   Chat UI    │   │   Chat UI    │   │   Chat UI    │        │
│  │   (Room A)   │   │   (Room B)   │   │   (Room C)   │        │
│  └──────┬───────┘   └──────┬───────┘   └──────┬───────┘        │
│         │                  │                  │                │
│         └──────────────────┴──────────────────┘                │
│                            │                                   │
│                    Socket.IO Client                            │
└────────────────────────────┼───────────────────────────────────┘
                             │
                             │ WebSocket
                             │
┌────────────────────────────┼──────────────────────────────────┐
│                    Backend Layer                              │
│                            │                                  │
│  ┌─────────────────────────▼──────────────────────────────┐   │
│  │              Socket.IO Server (Express)                │   │
│  │  ┌────────────┐ ┌────────────┐ ┌─────────────────┐     │   │
│  │  │   Rate     │ │   Event    │ │   Connection    │     │   │
│  │  │  Limiter   │ │  Handlers  │ │   Management    │     │   │
│  │  └────────────┘ └────────────┘ └─────────────────┘     │   │
│  └────────────┬───────────┬──────────────┬────────────────┘   │
│               │           │              │                    │
│               │           │              │                    │
│  ┌────────────▼───┐   ┌───▼─────────┐   ┌▼───────────────┐    │
│  │ User Manager   │   │   Message   │   │  AI Stream     │    │
│  │   Service      │   │   Service   │   │   Manager      │    │
│  └────────────────┘   └─────┬───────┘   └────┬───────────┘    │
│                             │                │                │
└─────────────────────────────┼────────────────┼────────────────┘
                              │                │
                ┌─────────────┴────────┐       │
                │                      │       │
┌───────────────▼───────┐  ┌───────────▼───────▼───────────────┐
│    Redis Layer        │  │      Temporal Layer               │
│                       │  │                                   │
│  ┌─────────────────┐  │  │  ┌──────────────────────────────┐ │
│  │   Pub/Sub       │  │  │  │   AI Streaming Workflows     │ │
│  │   (Adapter)     │  │  │  │   (Durable Execution)        │ │
│  └─────────────────┘  │  │  └──────────────────────────────┘ │
│                       │  │                                   │
│  ┌─────────────────┐  │  │  ┌──────────────────────────────┐ │
│  │  Chat History   │  │  │  │   Activities                 │ │
│  │  (Streams)      │  │  │  │   - AI Service               │ │
│  └─────────────────┘  │  │  │   - Socket Emission          │ │
│                       │  │  └──────────────────────────────┘ │
│  ┌─────────────────┐  │  │                                   │
│  │  Rate Limiting  │  │  │  ┌──────────────────────────────┐ │
│  │  State          │  │  │  │   Worker(s)                  │ │
│  └─────────────────┘  │  │  │   (Scalable)                 │ │
└───────────────────────┘  └──┴──────────────────────────────┴─┘
                               │
                    ┌──────────▼──────────┐
                    │   OpenAI API        │
                    │   (AI Streaming)    │
                    └─────────────────────┘
```

## Architecture Strong Points

### 1. **Horizontal Scalability**
- **Redis Adapter for Socket.IO**: Multiple backend instances can run simultaneously, sharing WebSocket connections through Redis pub/sub
- **Stateless Backend**: All session state stored in Redis, enabling seamless load balancing
- **Independent Temporal Workers**: AI processing can scale independently from WebSocket servers

### 2. **Reliability & Fault Tolerance**
- **Durable Workflows**: Temporal ensures AI streaming operations complete even if servers restart
- **Graceful Shutdown**: Proper cleanup of connections, workers, and resources on shutdown
- **Error Recovery**: Comprehensive error handling with retry mechanisms
- **Message Persistence**: Redis Streams ensure chat history is never lost

### 3. **Type Safety**
- **End-to-End TypeScript**: Shared types between frontend, backend, and Temporal workflows
- **Runtime Validation**: Zod schemas validate all incoming data at runtime
- **Compile-Time Checks**: Catch errors before deployment with strict TypeScript configuration

### 4. **Performance**
- **Streaming Responses**: AI responses stream in real-time for better UX
- **Rate Limiting**: Protects backend from abuse with per-user, per-event rate limits
- **Efficient Message Storage**: Redis Streams provide O(1) append and range queries
- **Connection Pooling**: Reusable Redis connections across the application

### 5. **Developer Experience**
- **Monorepo Structure**: Shared code eliminates duplication and inconsistencies
- **Hot Reload**: Fast development cycles with Vite and nodemon
- **Structured Logging**: Pino provides JSON logs with context for debugging
- **Type-Safe APIs**: Socket.IO events are fully typed for autocomplete and error checking

### 6. **Production Ready**
- **Health Checks**: Built-in health endpoints for monitoring
- **Environment-Based Config**: Easy configuration for different environments
- **Docker Integration**: Infrastructure as code with docker-compose
- **Observability**: Structured logging with context throughout the stack

### 7. **Separation of Concerns**
- **Service Layer Pattern**: Business logic separated from infrastructure
- **Event-Driven Architecture**: Loosely coupled components communicate via events
- **Dependency Injection**: Service container manages dependencies
- **Clean Handler Pattern**: Each Socket.IO event has its own handler module

### 8. **Security**
- **Input Validation**: All user input validated with Zod schemas
- **Rate Limiting**: Protection against DoS attacks
- **CORS Configuration**: Controlled cross-origin access
- **Error Message Sanitization**: Internal errors not exposed to clients

## Key Design Decisions

1. **Temporal for AI Workflows**: Ensures AI operations complete reliably even during server failures
2. **Redis Streams for History**: Provides efficient, append-only message storage with range queries
3. **Shared Package**: Eliminates type mismatches between frontend and backend
4. **Service Container Pattern**: Centralized dependency management and lifecycle control
5. **Socket.IO over Raw WebSockets**: Built-in room support, reconnection, and fallback mechanisms

## Testing

```bash
# Type checking
make type-check

# Linting
make lint
```

## License

MIT
