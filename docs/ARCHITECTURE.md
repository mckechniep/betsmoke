# BetSmoke Architecture Overview

This document explains how BetSmoke is structured, how the different parts connect, and the key design decisions.

---

## High-Level Architecture

```
┌─────────────────────────────────────────────────────────────────────────┐
│                           USER'S BROWSER                                 │
│                                                                         │
│  ┌─────────────────────────────────────────────────────────────────┐   │
│  │                    REACT FRONTEND (Vite)                         │   │
│  │                    http://localhost:5173                         │   │
│  │                                                                  │   │
│  │  ┌──────────┐ ┌──────────┐ ┌──────────┐ ┌──────────┐           │   │
│  │  │  Pages   │ │Components│ │  Context │ │API Client│           │   │
│  │  │(Fixtures,│ │(Navbar,  │ │  (Auth)  │ │(client.js│           │   │
│  │  │ Teams,   │ │ Layout)  │ │          │ │          │           │   │
│  │  │ Notes)   │ │          │ │          │ │          │           │   │
│  │  └──────────┘ └──────────┘ └──────────┘ └────┬─────┘           │   │
│  └─────────────────────────────────────────────────────────────────┘   │
└───────────────────────────────────────────────────────────────────────┘
                                   │
                                   │ HTTP/JSON
                                   ▼
┌─────────────────────────────────────────────────────────────────────────┐
│                       EXPRESS BACKEND (Node.js)                          │
│                       http://localhost:3001                              │
│                                                                         │
│  ┌─────────────────────────────────────────────────────────────────┐   │
│  │                          ROUTES LAYER                            │   │
│  │                                                                  │   │
│  │  /auth      - Registration, login, password recovery             │   │
│  │  /notes     - CRUD for user notes (protected)                    │   │
│  │  /teams     - Team search, stats, H2H, squad, corners            │   │
│  │  /fixtures  - Match data, date search, predictions               │   │
│  │  /standings - League tables                                      │   │
│  │  /odds      - Betting odds, bookmakers, markets                  │   │
│  │  /leagues   - Competition info                                   │   │
│  │  /seasons   - Season data                                        │   │
│  │  /livescores- Real-time match scores                             │   │
│  │  /topscorers- Goal scoring leaderboards                          │   │
│  │  /predictions- Model performance stats                           │   │
│  │  /players   - Player search and details                          │   │
│  └──────────┬──────────────────────────────────────────────────────┘   │
│             │                                                           │
│  ┌──────────▼──────────────────────────────────────────────────────┐   │
│  │                        SERVICES LAYER                            │   │
│  │                                                                  │   │
│  │  sportsmonks.js  - All SportsMonks API calls                     │   │
│  │  types.js        - Type lookups from local DB                    │   │
│  │  cache.js        - In-memory caching (node-cache)                │   │
│  │  email.js        - Password reset emails (Mailjet)               │   │
│  └──────────┬──────────────────────────────────────────────────────┘   │
│             │                                                           │
│  ┌──────────▼──────────────────────────────────────────────────────┐   │
│  │                      MIDDLEWARE LAYER                            │   │
│  │                                                                  │   │
│  │  auth.js  - JWT verification, admin check                        │   │
│  └─────────────────────────────────────────────────────────────────┘   │
└───────────────────────────────────────────────────────────────────────┘
          │                                    │
          │ Prisma ORM                         │ HTTP/REST
          ▼                                    ▼
┌─────────────────────┐              ┌─────────────────────┐
│     POSTGRESQL      │              │   SPORTSMONKS API   │
│     (Docker)        │              │                     │
│                     │              │  - Football data    │
│  - Users            │              │  - Odds data        │
│  - Notes            │              │  - Predictions      │
│  - NoteLinks        │              │  - Live scores      │
│  - PasswordResets   │              │                     │
│  - SportsMonksTypes │              │                     │
└─────────────────────┘              └─────────────────────┘
```

---

## Data Ownership Model

BetSmoke follows a clear separation between **external data** (read-only, from SportsMonks) and **internal data** (owned by BetSmoke).

### External Data (SportsMonks)
- Fixtures, teams, standings, head-to-head stats
- League and season information
- Player details and statistics
- Betting odds and predictions
- Live scores

This data is **fetched live** (with caching) and **never stored** in our database.

### Internal Data (PostgreSQL)
- User accounts and preferences
- User notes with context links
- Password reset tokens
- SportsMonks type definitions (cached locally for performance)

**Key Rule**: BetSmoke stores *thoughts* (user notes), not *facts* (football data).

---

## Database Schema

### Users
```prisma
model User {
  id        String   @id @default(uuid())
  email     String   @unique
  password  String                          // bcrypt hashed
  
  // Preferences
  oddsFormat  OddsFormat @default(AMERICAN) // AMERICAN | DECIMAL | FRACTIONAL
  timezone    String     @default("America/New_York")
  
  // Account recovery
  securityQuestion  String?
  securityAnswer    String?                 // bcrypt hashed
  
  // Admin access
  isAdmin     Boolean   @default(false)
  
  // Relations
  notes          Note[]
  passwordResets PasswordReset[]
}
```

### Notes
```prisma
model Note {
  id        String    @id @default(uuid())
  title     String
  content   String
  userId    String
  user      User      @relation(...)
  links     NoteLink[]
}

model NoteLink {
  id          String      @id @default(uuid())
  noteId      String
  contextType ContextType // team | fixture | player | league | betting | general
  contextId   String      // SportsMonks ID (e.g., "19" for Arsenal)
  label       String?     // Human-readable (e.g., "Arsenal")
  isPrimary   Boolean     @default(false)
}
```

### SportsMonks Types (Local Cache)
```prisma
model SportsMonksType {
  id            Int      @id            // SportsMonks type ID
  name          String                  // "Corners", "Goal", etc.
  code          String                  // "corners", "goal"
  developerName String                  // "CORNERS", "GOAL"
  modelType     String                  // "statistic", "event", etc.
  group         String?                 // Sub-category
  statGroup     String?                 // "overall", "home", "away"
  parentId      Int?                    // Hierarchy support
}
```

---

## Authentication Flow

```
1. User submits email/password to POST /auth/login

2. Backend validates credentials against PostgreSQL

3. If valid, generate JWT with { userId } payload
   - Token expires in 7 days

4. Return token + user profile to frontend

5. Frontend stores token in localStorage

6. For protected routes, frontend sends:
   Authorization: Bearer <token>

7. authMiddleware verifies token on each request
   - If valid: attach req.user.userId and continue
   - If invalid: return 401 Unauthorized
```

---

## SportsMonks Integration Pattern

Instead of making direct API calls from routes, we use a **service layer** pattern:

```
Route (fixtures.js)
    │
    │ calls
    ▼
Service (sportsmonks.js)
    │
    │ makeRequest()
    ▼
SportsMonks API
    │
    │ JSON response
    ▼
Service transforms/returns data
    │
    ▼
Route sends response to client
```

### Key Benefits:
1. **Centralized API key management** - Single place for auth
2. **Consistent error handling** - All errors logged and formatted
3. **Include parameters** - Each function knows what related data to request
4. **Easy to mock** - For testing, swap the service

### Type Enrichment

SportsMonks returns `type_id` numbers instead of names. Instead of including `.type` on every API call (which adds overhead), we:

1. Store all types locally in PostgreSQL
2. Load them into memory on server startup
3. Look up names by ID using `types.js` service
4. Enrich API responses before sending to frontend

```javascript
// Before enrichment
{ type_id: 34, data: { value: 6 } }

// After enrichment  
{ type_id: 34, data: { value: 6 }, typeName: "Corners" }
```

---

## Caching Strategy

### In-Memory Cache (node-cache)
Used for data that's computed from multiple API calls:

| Data Type | TTL | Key Format |
|-----------|-----|------------|
| Corner averages | 12 hours | `corners:{teamId}:{seasonId}` |
| Season dates | 24 hours | `season:{seasonId}` |

### When to Cache:
- Data requires multiple API calls to compute
- Data doesn't change frequently
- Computation is expensive

### When NOT to Cache:
- Live scores (needs real-time data)
- User-specific data
- Rapidly changing stats

---

## Frontend Architecture

### Component Structure
```
App.jsx                    # Root component with routes
├── Layout.jsx             # Shared layout (navbar, container)
├── Pages/
│   ├── Home.jsx           # Landing page
│   ├── Fixtures.jsx       # Fixture list with search
│   ├── FixtureDetail.jsx  # Single match analysis
│   ├── Teams.jsx          # Team search
│   ├── TeamDetail.jsx     # Team stats and roster
│   ├── Competitions.jsx   # League/cup views
│   ├── Notes.jsx          # User notes list
│   └── ...
└── Components/
    ├── Navbar.jsx         # Navigation
    ├── ProtectedRoute.jsx # Auth guard
    └── ...
```

### State Management
- **AuthContext** - Global auth state (user, token, login/logout)
- **React hooks** - Local component state
- No external state library (Redux, Zustand) - app is simple enough

### API Client Pattern
```javascript
// api/client.js provides typed methods

// Public data (no auth needed)
dataApi.getFixture(id)
dataApi.searchTeams(query)

// Protected data (requires token)
notesApi.create(data, token)
authApi.getMe(token)
```

---

## Security Considerations

### Password Storage
- Bcrypt with 10 salt rounds
- Security question answers also hashed

### JWT Tokens
- 7-day expiration
- Stored in localStorage (client-side)
- Sent via `Authorization: Bearer` header

### API Protection
- Public routes: Team/fixture data (read-only SportsMonks proxy)
- Protected routes: Notes CRUD (requires valid JWT)
- Admin routes: Type sync (requires JWT + isAdmin flag)

### Input Validation
- All routes validate required fields
- Date formats checked with regex
- IDs verified as numbers

---

## Error Handling

### Backend
```javascript
// Routes use try/catch with consistent error format
try {
  // ... operation
} catch (error) {
  console.error('Operation failed:', error);
  res.status(500).json({ 
    error: 'User-friendly message',
    details: error.message  // Only in development
  });
}
```

### Frontend
```javascript
// API client throws errors for non-2xx responses
try {
  const data = await dataApi.getFixture(id);
} catch (error) {
  setError(error.message);  // Display to user
}
```

---

## Development vs Production

### Development
- Backend: `npm run dev` (nodemon with hot reload)
- Frontend: `npm run dev` (Vite dev server)
- Database: Docker container

### Production (Recommended Setup)
- Backend: `npm start` with process manager (PM2)
- Frontend: `npm run build` → serve static files
- Database: Managed PostgreSQL (e.g., Railway, Render, AWS RDS)
- Environment: All secrets in environment variables

---

## Next Steps / Future Improvements

1. **Caching Layer** - Redis for shared caching across instances
2. **Rate Limiting** - Protect against API abuse
3. **Testing** - Unit tests for services, integration tests for routes
4. **Monitoring** - Request logging, error tracking
5. **Mobile App** - React Native with shared API client
