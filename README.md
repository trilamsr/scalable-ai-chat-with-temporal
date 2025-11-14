# Scalable AI Chat App

A real-time chat application with 3 independent chat windows running side-by-side, powered by WebSocket connections. Built with React frontend and Node.js backend, fully containerized with Docker.

## Features

- **3 Side-by-Side Chat Windows**: Three independent chat clients in a single interface
- **Real-time Communication**: WebSocket-based messaging with Socket.io
- **User Presence**: See who's online in real-time
- **Typing Indicators**: Know when other users are typing
- **System Notifications**: Join/leave notifications
- **Responsive Design**: Works on desktop and mobile devices
- **Dockerized**: Easy deployment with Docker Compose

## Architecture

```
├── shared/                    # Shared code between backend and frontend
│   ├── src/
│   │   ├── types.ts          # Shared TypeScript types
│   │   └── logger.interface.ts  # Logger interface
│   └── package.json
├── backend/                   # Node.js WebSocket server (TypeScript)
│   ├── src/
│   │   ├── server.ts         # Main server file
│   │   ├── socket.ts         # Socket handlers
│   │   ├── logger.ts         # Pino logger (Node.js)
│   │   └── types.ts          # Re-exports from shared
│   ├── package.json
│   ├── tsconfig.json
│   └── Dockerfile
├── frontend/                  # React application (TypeScript + Tailwind)
│   ├── src/
│   │   ├── App.tsx
│   │   ├── components/
│   │   │   └── ChatWindow.tsx
│   │   ├── utils/
│   │   │   └── logger.ts     # Pino logger (Browser)
│   │   └── types.ts          # Re-exports from shared
│   ├── package.json
│   ├── tsconfig.json
│   └── Dockerfile
├── docker-compose.yml         # Production compose
└── docker-compose.dev.yml     # Development compose with hot-reload
```

## Prerequisites

- Docker (version 20.10 or higher)
- Docker Compose (version 2.0 or higher)

## Quick Start with Docker

### Development Mode (with hot-reloading)

1. **Clone the repository** (if applicable):
   ```bash
   git clone <repository-url>
   cd scalable-ai-chat-app
   ```

2. **Start the application in development mode**:
   ```bash
   docker-compose -f docker-compose.dev.yml up --build
   ```

   This will:
   - Enable hot-reloading for both frontend and backend
   - Mount your source code as volumes
   - Use nodemon for backend (TypeScript auto-compilation)
   - Use React dev server for frontend
   - Show debug logs

3. **Make changes to your code** - they will automatically reload!

4. **Stop the application**:
   ```bash
   docker-compose -f docker-compose.dev.yml down
   ```

### Production Mode

1. **Start the application**:
   ```bash
   docker-compose up --build
   ```

3. **Access the application**:
   - Frontend: http://localhost:3000
   - Backend API: http://localhost:4000

4. **Stop the application**:
   ```bash
   docker-compose down
   ```

## Development Setup (Without Docker)

### Backend

1. Navigate to backend directory:
   ```bash
   cd backend
   ```

2. Install dependencies:
   ```bash
   npm install
   ```

3. Start the server:
   ```bash
   npm start
   ```

   The backend will run on http://localhost:4000

### Frontend

1. Navigate to frontend directory:
   ```bash
   cd frontend
   ```

2. Install dependencies:
   ```bash
   npm install
   ```

3. Start the development server:
   ```bash
   npm start
   ```

   The frontend will run on http://localhost:3000

## How It Works

### Backend (WebSocket Server)

The backend uses Express and Socket.io to manage WebSocket connections. It handles:
- User connections and disconnections
- Message broadcasting to all connected clients
- User presence tracking
- Typing indicators

### Frontend (React Application)

The frontend creates 3 independent Socket.io connections, each representing a different user:
- **User-Blue** (Chat Window 1)
- **User-Green** (Chat Window 2)
- **User-Purple** (Chat Window 3)

Each window:
- Maintains its own WebSocket connection
- Receives all messages from the server
- Can send messages independently
- Shows real-time user presence and typing indicators

## Environment Variables

### Backend

- `PORT`: Server port (default: 4000)
- `FRONTEND_URL`: Allowed CORS origin (default: http://localhost:3000)

### Frontend

- `REACT_APP_BACKEND_URL`: Backend WebSocket URL (default: http://localhost:4000)

## Docker Configuration

### Building Individual Services

Build backend only:
```bash
docker-compose build backend
```

Build frontend only:
```bash
docker-compose build frontend
```

### Running in Detached Mode

```bash
docker-compose up -d
```

### Viewing Logs

```bash
docker-compose logs -f
```

View specific service logs:
```bash
docker-compose logs -f backend
docker-compose logs -f frontend
```

### Removing Containers and Networks

```bash
docker-compose down
```

Remove volumes as well:
```bash
docker-compose down -v
```

## Testing the Application

1. Open http://localhost:3000 in your browser
2. You'll see 3 chat windows side by side
3. Type a message in any window and press "Send"
4. The message will appear in all 3 windows simultaneously
5. Each window has a different username and color scheme
6. Observe typing indicators and online user counts

## Scaling

To scale the backend service:

```bash
docker-compose up --scale backend=3
```

Note: For production scaling with multiple backend instances, you'll need to implement a Redis adapter for Socket.io to sync messages across instances.

## Production Considerations

1. **Environment Variables**: Use proper environment variables for production URLs
2. **SSL/TLS**: Add HTTPS support with certificates
3. **Redis**: Implement Redis adapter for Socket.io when scaling horizontally
4. **Monitoring**: Add logging and monitoring solutions
5. **Load Balancing**: Use a load balancer for multiple backend instances
6. **Database**: Add persistent storage for chat history

## Technologies Used

- **Frontend**: React, Socket.io Client, CSS3
- **Backend**: Node.js, Express, Socket.io
- **Containerization**: Docker, Docker Compose
- **Web Server**: Nginx (for production frontend)

## License

MIT

## Contributing

Feel free to submit issues and pull requests!
