# BetSmoke - Claude Instructions

## Project Overview

**BetSmoke** is a soccer betting research application that combines live football data from the SportsMonks API with persistent user notes to support disciplined betting decisions.

It is a **betting journal + research terminal**, NOT a gambling platform.

### What BetSmoke Does
- Aggregates football data (fixtures, teams, standings, H2H stats, player info)
- Displays odds data from SportsMonks (pre-match odds, winning odds, historical odds)
- Allows users to create and manage notes tied to specific football contexts
- Helps users analyze matches before betting on external platforms

### What BetSmoke Does NOT Do
- Place bets
- Process payments
- Integrate with sportsbooks

---

## Tech Stack

| Layer | Technology |
|-------|------------|
| Backend | Node.js + Express.js |
| Database | PostgreSQL (Docker container) |
| ORM | Prisma |
| Auth | JWT tokens + bcrypt |
| External Data | SportsMonks API (Standard Plan) |
| Frontend | React + Vite + Tailwind CSS |

---

## Project Structure
```
/home/mckechniep/projects/betsmoke/
│
├── prisma/
│   ├── schema.prisma              # Database schema definition
│   └── migrations/                # Prisma migration history
│
├── src/
│   ├── index.js                   # Express app entry point
│   ├── db.js                      # Prisma client instance
│   │
│   ├── routes/
│   │   ├── auth.js                # Register/login endpoints
│   │   ├── notes.js               # Notes CRUD endpoints
│   │   ├── teams.js               # Team data endpoints
│   │   ├── fixtures.js            # Fixture data endpoints
│   │   ├── players.js             # Player search endpoints
│   │   └── odds.js                # Odds data endpoints
│   │
│   ├── services/
│   │   ├── sportsmonks.js         # SportsMonks API wrapper
│   │   └── types.js               # SportsMonks types lookup service
│   │
│   ├── middleware/
│   │   └── auth.js                # JWT verification middleware
│   │
│   └── generated/
│       └── prisma/                # Auto-generated Prisma client
│
├── frontend/                      # React frontend application
│   ├── src/
│   │   ├── api/
│   │   │   └── client.js          # API client for backend calls
│   │   ├── components/
│   │   │   ├── Navbar.jsx         # Navigation bar with admin menu
│   │   │   ├── ProtectedRoute.jsx # Auth route wrapper
│   │   │   └── MatchPredictions.jsx # Match prediction display
│   │   ├── context/
│   │   │   └── AuthContext.jsx    # User auth state management
│   │   ├── pages/
│   │   │   ├── Login.jsx          # Login page
│   │   │   ├── Register.jsx       # Registration page
│   │   │   ├── Fixtures.jsx       # Fixtures list page
│   │   │   ├── FixtureDetail.jsx  # Single fixture detail page
│   │   │   ├── AccountSettings.jsx # User preferences page
│   │   │   └── ModelPerformance.jsx # Prediction model stats
│   │   ├── utils/
│   │   │   └── formatters.js      # Centralized formatting utilities
│   │   ├── App.jsx                # Main app component
│   │   └── main.jsx               # Entry point
│   ├── package.json
│   └── vite.config.js
│
├── scripts/
│   └── seed-sportsmonks-types.js  # Seeds types from Excel file
│
├── other/
│   └── Types_overview API V3.xlsx # SportsMonks types reference data
│
├── prisma.config.ts               # Prisma configuration
├── docker-compose.yml             # PostgreSQL container config
├── package.json                   # Dependencies and scripts
├── package-lock.json              # Dependency lock file
├── .env                           # Environment variables (not committed)
└── .gitignore                     # Git ignore rules
```

---

## Development Environment

### Location
- WSL Ubuntu: `/home/mckechniep/projects/betsmoke`

### Docker Database
- Container name: `betsmoke-db`
- Port: `5432`
- Start command: `docker start betsmoke-db`

### Running the Server
```bash
cd /home/mckechniep/projects/betsmoke
npm run dev        # Backend on http://localhost:3000
cd frontend && npm run dev  # Frontend on http://localhost:5173
```

### Required Environment Variables
```
DATABASE_URL=postgresql://user:password@localhost:5432/betsmoke
JWT_SECRET=your-secret-key
SPORTSMONKS_API_KEY=your-api-key
```

---

## Coding Conventions

### ES6 Syntax
Always use modern ES6+ JavaScript:
```javascript
// ✅ Use arrow functions
const getTeam = async (teamId) => {
    // function body
};

// ✅ Use const/let, never var
const fixedValue = 'something';
let changingValue = 0;

// ✅ Use template literals
const message = `Team ${teamId} not found`;

// ✅ Use destructuring
const { email, password } = req.body;

// ✅ Use async/await, not .then() chains
const user = await prisma.user.findUnique({ where: { id } });

// ✅ Use spread operator
const updatedNote = { ...existingNote, ...newData };
```

### Code Clarity Over Cleverness
Write code that is **easy to understand**, even if it's longer:
```javascript
// ✅ GOOD: Clear and explicit
const validateEmail = (email) => {
    // Check if email exists
    if (!email) {
        return false;
    }
    
    // Check if email contains @ symbol
    if (!email.includes('@')) {
        return false;
    }
    
    return true;
};

// ❌ AVOID: Clever one-liners that are hard to read
const validateEmail = (e) => e && e.includes('@');
```

### Comment Style
Include explanatory comments - not on every line, but every logical section should be explained:
```javascript
// ============================================
// GET /api/teams/:id
// Fetches a single team by ID from SportsMonks
// ============================================
router.get('/:id', authenticateToken, async (req, res) => {
    try {
        // Extract team ID from URL parameters
        const { id } = req.params;
        
        // Validate that ID was provided
        if (!id) {
            return res.status(400).json({ error: 'Team ID is required' });
        }
        
        // Fetch team data from SportsMonks API
        // Include related data: players, coach, and venue
        const team = await sportsmonksService.getTeam(id, 'players;coach;venue');
        
        // Return the team data to the client
        return res.json({ data: team });
        
    } catch (error) {
        // Log error for debugging, return generic message to client
        console.error('Error fetching team:', error.message);
        return res.status(500).json({ error: 'Failed to fetch team data' });
    }
});
```

### Error Response Format
```javascript
res.status(400).json({ error: 'Description of what went wrong' });
```

### Success Response Format
```javascript
res.json({ data: result });
// or for lists:
res.json({ data: results, count: results.length });
```

### File Naming
- All lowercase
- Routes: `teams.js`, `fixtures.js`, `auth.js`
- Services: `sportsmonks.js`
- Use `.js` extension (not TypeScript for MVP)

---

## SportsMonks API Notes

### Base URL
```
https://api.sportmonks.com/v3/football/
```

### Authentication
- API key passed via `Authorization` header or query parameter
- Handled in `services/sportsmonks.js`

### Include Parameters
SportsMonks uses `include` parameters to enrich responses with related data:
```
/teams/123?include=players;coach;venue
```
Multiple includes separated by semicolons.

### Types System (Local Storage - Best Practice)

**IMPORTANT:** We do NOT use `.type` includes in API calls. Per SportsMonks recommendation, types are stored locally in our database and looked up by ID.

**Why?**
- Types are static reference data (~1200+ entries) that rarely change
- Including `.type` on every API call wastes bandwidth and quota
- Local lookup is faster (O(1) from in-memory cache)

**How it works:**
1. Types are fetched from SportsMonks `/core/types` endpoint and stored in `sportsmonks_types` table
2. On server startup, all types are loaded into memory cache
3. When API returns a `type_id`, use the types service to get the name

**Using the types service:**
```javascript
import { getTypeName, getTypeById, enrichStatsWithTypes } from './services/types.js';

// Get type name by ID
const name = await getTypeName(34);  // Returns: "Corners"

// Get full type object
const type = await getTypeById(34);
// Returns: { id: 34, name: "Corners", code: "corners", modelType: "statistic", ... }

// Batch enrich statistics array
await enrichStatsWithTypes(fixture.statistics);
// Each stat now has a `typeName` property
```

**Type categories (modelType):**
- `statistic` (133): Corners, Goals, Assists, Shots, Passes, etc.
- `event` (12): Goal, Yellowcard, Substitution, VAR, etc.
- `injury_suspension` (338): Hamstring Injury, Red Card Suspension, etc.
- `prediction` (36): BTTS Probability, Over/Under, Correct Score, etc.
- `position` (22): Goalkeeper, Midfielder, Centre Back, etc.
- `standings` (23): Overall Won, Home Goals, Away Points, etc.
- And more: period, referee, lineup, transfer, timeline, etc.

**Sync types (admin only - fetches latest from API):**
```
POST /admin/types/sync
Authorization: Bearer <admin-jwt-token>
```

**Initial seed (run once after fresh database setup):**
```bash
node scripts/seed-sportsmonks-types.js
```

**Check cache status:**
```
GET /types/status
```

### Known Quirks
- Odds endpoints may use different response structures than match endpoints
- Route ordering matters in Express - more specific routes must come before parameterized routes
- Some endpoints return nested data differently based on includes used
- **Fractional odds**: When denominator is 1, SportsMonks returns just the numerator (e.g., "15" instead of "15/1"). Our `formatOdds()` utility handles this automatically.
- **Odds label inconsistency**: Different bookmakers use different labels for the same market (e.g., "Home/Draw", "1X", "Home or Draw" all mean the same thing). The `normalizeLabel()` function in FixtureDetail.jsx handles this.

### Available Data (Standard Plan)
✅ Fixtures, Livescores, Events, Lineups, Match Stats
✅ Standings, H2H, Historical Data, Schedules
✅ Teams, Players, Injuries, Transfers, Squads
✅ Pre-match Odds, Historical Odds, Winning Odds

❌ In-play odds
❌ Ball tracking / coordinates
❌ Automated trend analysis

### API Coverage Scope (IMPORTANT FOR TESTING)
Our SportsMonks subscription is limited to specific competitions:

| Competition    | League ID |
|----------------|-----------|
| Premier League |     8     |
| FA Cup         |    24     |
| Carabao Cup    |    27     |

**This means:**
- ✅ Can access: Premier League teams, fixtures, odds, stats
- ✅ Can access: FA Cup and Carabao Cup fixtures (includes lower-league teams when they play in these cups)
- ❌ Cannot access: La Liga, Serie A, Bundesliga, Champions League, etc.
- ❌ Cannot access: Teams outside these competitions

**When testing:** If an API call returns empty or an error, first verify the team/fixture is within our coverage scope before assuming there's a bug. Use these known-good IDs for testing:
- League: `8` (Premier League)
- Team: `19` (Arsenal) or similar PL team
- Fixture: Use `/fixtures/date/{date}` with current PL matchday


---

## Database Schema

### Current Models

**User**
- `id`: UUID primary key
- `email`: Unique email address
- `password`: Hashed with bcrypt
- `isAdmin`: Boolean (default false) - grants access to admin endpoints
- `timezone`: String (default "America/New_York") - user's preferred timezone
- `oddsFormat`: Enum - AMERICAN, DECIMAL, FRACTIONAL (default AMERICAN)
- `dateFormat`: Enum - US, EU (default US) - date display preference
- `temperatureUnit`: Enum - FAHRENHEIT, CELSIUS (default FAHRENHEIT)
- `securityQuestion`, `securityAnswer`: Optional account recovery fields
- `createdAt`, `updatedAt`: Timestamps

**Note**
- `id`: UUID primary key
- `userId`: Foreign key to User (ownership)
- `title`: Note title
- `content`: Note body text
- `createdAt`, `updatedAt`: Timestamps
- `links`: Relation to NoteLink[]

**NoteLink** (Junction table for multi-context notes)
- `id`: UUID primary key
- `noteId`: Foreign key to Note (cascade delete)
- `contextType`: Enum - `team`, `fixture`, or `general`
- `contextId`: SportsMonks entity ID (empty string for general)
- `isPrimary`: Boolean - exactly one link per note must be primary
- `createdAt`: Timestamp
- Unique constraint: `[noteId, contextType, contextId]`

**SportsMonksType** (Reference/lookup data - ~1200+ types)
- `id`: Integer primary key (SportsMonks ID, NOT auto-generated)
- `parentId`: Optional parent type ID (for hierarchical relationships)
- `name`: Human-readable name (e.g., "Shots On Target")
- `code`: Kebab-case code (e.g., "shots-on-target")
- `developerName`: UPPER_SNAKE_CASE constant (e.g., "SHOTS_ON_TARGET")
- `modelType`: Category (statistic, event, injury_suspension, position, etc.)
- `group`: Sub-grouping within modelType (nullable)
- `statGroup`: Statistical grouping - overall, home, away, offensive, defensive (nullable)
- `lastSyncedAt`: Timestamp of last sync
- Indexes on: `modelType`, `code`, `developerName`
- Self-referencing relation for parent/child hierarchy

### How Note Linking Works

Notes can link to multiple contexts (teams, fixtures). One link must be marked as primary.

**Example:**
```
Note: "Liverpool looked shaky defensively against City"
├── Primary Link: fixture/12345 (Liverpool vs City match)
├── Secondary Link: team/123 (Liverpool)
└── Secondary Link: team/456 (Manchester City)
```

**API Usage:**
```json
POST /notes
{
  "title": "Match analysis",
  "content": "...",
  "links": [
    {"contextType": "fixture", "contextId": "12345", "isPrimary": true},
    {"contextType": "team", "contextId": "123"},
    {"contextType": "team", "contextId": "456"}
  ]
}
```

**Filtering:** `GET /notes?contextType=team&contextId=123` returns notes where ANY link matches.

### Key Rules
- Notes belong to ONE user (ownership validated on all operations)
- Notes can link to MULTIPLE contexts via NoteLink table
- Exactly one link must be marked as `isPrimary`
- BetSmoke stores user thoughts, NOT football facts
- Football data stays in SportsMonks, not duplicated locally

---

## Admin System

### Overview
Admin users have access to privileged operations like syncing SportsMonks types. Admin status is controlled via the `isAdmin` boolean field on the User model.

### Making a User an Admin
```bash
node scripts/promote-admin.js <email>
```

### Admin Middleware
The `adminMiddleware` in `src/middleware/auth.js` protects admin routes:
- Must be used AFTER `authMiddleware` (requires `req.user.userId`)
- Checks `isAdmin` flag in database
- Returns 403 if user is not an admin

**Usage in routes:**
```javascript
app.post('/admin/something', authMiddleware, adminMiddleware, handler);
```

### Admin Endpoints

| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/admin/types/sync` | Sync SportsMonks types from API to local database |

### Frontend Admin UI
Admin users see an amber **Admin** button in the navbar (between email and Logout).

**Location:** `frontend/src/components/Navbar.jsx`

**Features:**
- Only visible when `user.isAdmin === true`
- Dropdown menu with admin actions
- "Sync SportsMonks Types" button with:
  - Spinner animation while syncing
  - Success message showing count (e.g., "Synced 1275 types (0 new, 1275 updated)")
  - Error message if sync fails

**API Client:** `frontend/src/api/client.js`
```javascript
adminApi.syncTypes(token)  // POST /admin/types/sync
```

### Important Notes
- Users must **log out and log back in** after being promoted to admin (to refresh the JWT/user object)
- Admin status is checked on every admin request (not cached in JWT)
- The `isAdmin` field is included in the `sanitizeUser` response from login

---

## User Preferences System

### Overview
Users can customize how data is displayed throughout the app. Preferences are stored in the database and applied client-side.

### Available Preferences

| Preference | Options | Default | Affects |
|------------|---------|---------|---------|
| Timezone | IANA timezone strings | America/New_York | Match times |
| Date Format | US / EU | US | All date displays |
| Temperature Unit | FAHRENHEIT / CELSIUS | FAHRENHEIT | Weather display |
| Odds Format | AMERICAN / DECIMAL / FRACTIONAL | AMERICAN | All odds displays |

### Date Format Examples
- **US**: "Friday, January 25, 2026" / "Jan 25, 2026"
- **EU**: "Friday, 25 January 2026" / "25 Jan 2026"

### Backend Endpoints
```
PATCH /auth/preferences
{
  "timezone": "Europe/London",
  "dateFormat": "EU",
  "temperatureUnit": "CELSIUS",
  "oddsFormat": "DECIMAL"
}
```

### Frontend Implementation

**Location:** `frontend/src/utils/formatters.js`

Centralized formatting utilities that respect user preferences:

```javascript
import { formatTime, formatDate, formatShortDate, formatTemperature, formatOdds } from '../utils/formatters';

// Time formatting (timezone-aware)
formatTime("2024-12-26 15:00:00", "America/New_York")  // "10:00 AM ET"
formatTime("2024-12-26 15:00:00", "Europe/London")     // "3:00 PM GMT"

// Date formatting
formatDate("2024-12-26 15:00:00", timezone, "US")  // "Thursday, December 26, 2024"
formatDate("2024-12-26 15:00:00", timezone, "EU")  // "Thursday, 26 December 2024"

// Temperature
formatTemperature(22, "FAHRENHEIT")  // "72°F"
formatTemperature(22, "CELSIUS")     // "22°C"

// Odds (uses SportsMonks data fields directly)
formatOdds(oddObject, "AMERICAN")    // "+150" or "-110"
formatOdds(oddObject, "DECIMAL")     // "2.50"
formatOdds(oddObject, "FRACTIONAL")  // "3/2" or "15/1"
```

### Key Implementation Details

**Timezone Handling:**
- SportsMonks returns all times in UTC format: "2024-12-26 15:00:00"
- `parseUTCDateTime()` converts to JS Date with explicit UTC marker
- `formatTime()` converts to user's timezone with abbreviation (ET, PT, GMT, etc.)

**Odds Data from SportsMonks:**
- SportsMonks returns odds in ALL formats - no conversion needed!
- `value` or `decimal`: Decimal odds (e.g., "1.78")
- `fractional`: Fractional odds (e.g., "39/50")
- `american`: American odds (e.g., "+150" or "-110")
- Just select the appropriate field based on user preference

**SportsMonks Quirk - Fractional Odds:**
- When denominator is 1, SportsMonks omits it (returns "15" instead of "15/1")
- `formatOdds()` automatically appends "/1" when no slash present

### Usage Pattern in Components
```javascript
import { useAuth } from '../context/AuthContext';
import { formatTime, formatDate, formatTemperature, formatOdds } from '../utils/formatters';

function MyComponent() {
  const { user } = useAuth();
  const timezone = user?.timezone || 'America/New_York';
  const dateFormat = user?.dateFormat || 'US';
  const temperatureUnit = user?.temperatureUnit || 'FAHRENHEIT';
  const oddsFormat = user?.oddsFormat || 'AMERICAN';

  return (
    <div>
      <p>{formatTime(fixture.starting_at, timezone)}</p>
      <p>{formatDate(fixture.starting_at, timezone, dateFormat)}</p>
      <p>{formatTemperature(weather.temp, temperatureUnit)}</p>
      <p>{formatOdds(oddObject, oddsFormat)}</p>
    </div>
  );
}
```

---

## Working Style Preferences

### Development Approach
- **Nice and slow, modular, piece by piece**
- Build one complete feature before moving to the next
- Test each endpoint thoroughly before proceeding
- Prefer complete, well-documented implementations over prototypes

### What "Complete" Means
Each endpoint implementation should include:
1. Route handler with proper HTTP method
2. Input validation
3. Service function for business logic
4. Error handling with clear messages
5. Success response
6. Example curl command for testing
7. Brief documentation of what it does

### Testing Approach
- Test incrementally using curl commands
- Verify auth protection on protected routes
- Test both success and error cases
- Confirm ownership validation on user-owned resources

---

## Current State (Update as Needed)

### Completed (MVP Backend)
- ✅ User authentication (register, login, JWT)
- ✅ Auth middleware for protected routes
- ✅ Notes CRUD with ownership validation
- ✅ Team endpoints (search, details, H2H)
- ✅ Fixture endpoints (by date, by team, search)
- ✅ Player search
- ✅ Odds endpoints (pre-match, bookmakers, markets)
- ✅ Team stats (squad, transfers, seasons, coach)
- ✅ Note linking system (NoteLink junction table)
- ✅ Standings - League tables by season (GET /standings/seasons/:seasonId)
- ✅ Live Scores - Real-time match scores (GET /livescores, GET /livescores/inplay)
- ✅ Leagues - List/search competitions (GET /leagues, GET /leagues/:id, GET /leagues/search/:query)
- ✅ Seasons - Navigate historical data (GET /seasons, GET /seasons/:id, GET /seasons/leagues/:leagueId)
- ✅ Top Scorers - Player leaderboards (GET /topscorers/seasons/:seasonId)
- ✅ SportsMonks Types - Local storage of ~1200+ types with in-memory cache (GET /types/status)
- ✅ Admin System - isAdmin flag, admin middleware, frontend Admin menu (POST /admin/types/sync)
- ✅ User Preferences - timezone, oddsFormat, dateFormat, temperatureUnit (PATCH /auth/preferences)

### Completed (Frontend)
- ✅ React + Vite + Tailwind CSS setup
- ✅ Authentication flow (Login, Register pages)
- ✅ AuthContext for user state management
- ✅ Protected routes
- ✅ Fixtures list page with date navigation
- ✅ Fixture detail page with:
  - Match info (date, venue, weather, formations)
  - Live/final scores with proper status handling (FT, AET, PEN, LIVE)
  - Odds display (pre-match odds from multiple bookmakers)
  - All Betting Markets section with normalized labels and table layout
  - Match predictions display
- ✅ Account Settings page (timezone, date format, temperature, odds format)
- ✅ Model Performance page (prediction accuracy stats)
- ✅ Centralized formatters utility (frontend/src/utils/formatters.js)
- ✅ User preferences applied to all displays (timezone, date, temperature, odds)
- ✅ Admin dropdown menu in navbar

### Not Yet Started

**Infrastructure:**
- ⬜ Caching layer
- ⬜ Deployment configuration

**Features:**
- ⬜ Notes UI (create, edit, delete notes)
- ⬜ Team detail pages
- ⬜ Player detail pages
- ⬜ Search functionality

---

## Explicit Boundaries

### Never Suggest
- Bet placement features
- Payment processing
- Sportsbook API integrations
- Gambling compliance features

### Always Remember
- SportsMonks is the single source of truth for football data
- BetSmoke owns only user-generated data (accounts, notes)
- Keep architecture simple and explicit
- Optimize for MVP clarity, not premature abstraction

---

## Quick Reference Commands
```bash
# Start database
docker start betsmoke-db

# Run backend development server (from project root)
npm run dev

# Run frontend development server (from frontend/ directory)
cd frontend && npm run dev

# Run both backend and frontend (in separate terminals)
# Terminal 1: npm run dev
# Terminal 2: cd frontend && npm run dev

# Run Prisma migrations
npx prisma migrate dev

# Open Prisma Studio (database GUI)
npx prisma studio

# Generate Prisma client after schema changes
npx prisma generate

# Seed SportsMonks types (run after fresh database setup)
node scripts/seed-sportsmonks-types.js

# Promote a user to admin
node scripts/promote-admin.js <email>
```

### Frontend Development Notes
- Backend runs on `http://localhost:3000`
- Frontend runs on `http://localhost:5173`
- Frontend proxies API requests to backend via Vite config
- After changing backend User model, restart backend to pick up new Prisma client

---

## One-Line Summary

> BetSmoke is a soccer betting research app that combines live SportsMonks football data with persistent user notes to support disciplined betting decisions on external platforms.