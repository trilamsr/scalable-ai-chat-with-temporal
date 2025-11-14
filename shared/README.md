# Shared Code

This folder contains shared code used by both the backend and frontend applications.

## Structure

```
shared/
├── src/
│   ├── index.ts                # Main export file
│   ├── types.ts                # Shared TypeScript types
│   ├── logger.interface.ts     # Logger interface
│   └── logger.config.ts        # Shared logger configuration
├── package.json
└── tsconfig.json
```

## Contents

### Types (`types.ts`)
Shared TypeScript interfaces and types used for:
- Socket.io events (client-to-server and server-to-client)
- Message structures
- User information
- Event payloads

### Logger Interface (`logger.interface.ts`)
Common logger interface that defines the logging contract for both backend and frontend implementations.

### Logger Configuration (`logger.config.ts`)
Shared Pino logger configuration including:
- Log levels (trace, debug, info, warn, error, fatal)
- Environment detection (development vs production)
- Base logger options (message keys, timestamp formatting)
- Helper functions for consistent logger setup

### Logger (`logger.ts`)
**Complete Pino logger initialization** - automatically detects environment:
- **Node.js (Backend)**: Configured with pino-pretty for colorized development logs
- **Browser (Frontend)**: Configured for browser console output
- **Single Import**: Backend and frontend just import and use - no initialization needed

## Usage

### Importing Types
```typescript
// Backend
import { Message, UserInfo, ServerToClientEvents } from './types';

// Frontend
import { Message, UserJoinedPayload } from './types';
```

### Importing Logger
```typescript
// Backend - just import and use!
import logger, { createChildLogger } from '@shared/logger';

logger.info('Server started');
const childLogger = createChildLogger({ module: 'auth' });
childLogger.debug('User authenticated');

// Frontend - same simple import!
import logger from '../utils/logger';

logger.info('App initialized');
```

**No configuration needed** - the logger automatically detects whether it's running in Node.js or Browser and configures itself appropriately!

## Benefits

- **Single Source of Truth**: Types are defined once and used everywhere
- **Type Safety**: Ensures frontend and backend stay in sync
- **Easier Maintenance**: Update types in one place
- **Reduced Duplication**: No need to copy-paste types between projects
