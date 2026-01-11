# BetSmoke API Reference

Complete documentation for all backend API endpoints.

**Base URL**: `http://localhost:3001`

---

## Table of Contents

1. [Health & Status](#health--status)
2. [Authentication](#authentication)
3. [Notes](#notes-protected)
4. [Teams](#teams)
5. [Fixtures](#fixtures)
6. [Standings](#standings)
7. [Leagues](#leagues)
8. [Seasons](#seasons)
9. [Live Scores](#live-scores)
10. [Top Scorers](#top-scorers)
11. [Predictions](#predictions)
12. [Odds](#odds)
13. [Players](#players)
14. [Admin](#admin-protected)

---

## Health & Status

### GET /health
Check if the server is running.

**Response:**
```json
{
  "status": "ok",
  "message": "BetSmoke API is running",
  "timestamp": "2025-01-11T12:00:00.000Z"
}
```

### GET /db-health
Check database connectivity.

**Response:**
```json
{
  "status": "ok",
  "message": "Database connected",
  "userCount": 5
}
```

### GET /types/status
Check the SportsMonks types cache status.

**Response:**
```json
{
  "status": "ok",
  "cache": {
    "loaded": true,
    "loadedAt": "2025-01-11T12:00:00.000Z",
    "totalTypes": 650,
    "modelTypes": ["event", "statistic", "injury_suspension", ...]
  }
}
```

---

## Authentication

All auth endpoints are under `/auth`.

### POST /auth/register
Create a new user account.

**Request Body:**
```json
{
  "email": "user@example.com",         // Required
  "password": "password123",           // Required, min 6 chars
  "oddsFormat": "AMERICAN",            // Optional: AMERICAN | DECIMAL | FRACTIONAL
  "timezone": "America/New_York",      // Optional: IANA timezone
  "securityQuestion": "First pet?",    // Optional
  "securityAnswer": "fluffy"           // Required if securityQuestion provided
}
```

**Response (201):**
```json
{
  "message": "User registered successfully",
  "user": {
    "id": "uuid",
    "email": "user@example.com",
    "oddsFormat": "AMERICAN",
    "timezone": "America/New_York",
    "hasSecurityQuestion": true,
    "isAdmin": false,
    "createdAt": "2025-01-11T12:00:00.000Z"
  }
}
```

---

### POST /auth/login
Authenticate and receive a JWT token.

**Request Body:**
```json
{
  "email": "user@example.com",
  "password": "password123"
}
```

**Response:**
```json
{
  "message": "Login successful",
  "token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
  "user": {
    "id": "uuid",
    "email": "user@example.com",
    "oddsFormat": "AMERICAN",
    "timezone": "America/New_York",
    "hasSecurityQuestion": true,
    "isAdmin": false,
    "createdAt": "2025-01-11T12:00:00.000Z"
  }
}
```

---

### GET /auth/me 🔐
Get the current user's profile.

**Headers:** `Authorization: Bearer <token>`

**Response:**
```json
{
  "user": {
    "id": "uuid",
    "email": "user@example.com",
    "oddsFormat": "AMERICAN",
    "timezone": "America/New_York",
    "hasSecurityQuestion": true,
    "isAdmin": false,
    "createdAt": "2025-01-11T12:00:00.000Z"
  }
}
```

---

### PATCH /auth/preferences 🔐
Update user preferences.

**Headers:** `Authorization: Bearer <token>`

**Request Body:**
```json
{
  "oddsFormat": "DECIMAL",
  "timezone": "Europe/London"
}
```

**Response:**
```json
{
  "message": "Preferences updated successfully",
  "user": { ... }
}
```

---

### PATCH /auth/email 🔐
Change email address (requires current password).

**Headers:** `Authorization: Bearer <token>`

**Request Body:**
```json
{
  "newEmail": "newemail@example.com",
  "password": "currentPassword123"
}
```

---

### PATCH /auth/password 🔐
Change password.

**Headers:** `Authorization: Bearer <token>`

**Request Body:**
```json
{
  "currentPassword": "oldPassword123",
  "newPassword": "newPassword456"
}
```

---

### PATCH /auth/security-question 🔐
Set or update security question.

**Headers:** `Authorization: Bearer <token>`

**Request Body:**
```json
{
  "securityQuestion": "What was your first pet's name?",
  "securityAnswer": "fluffy",
  "password": "currentPassword123"
}
```

---

### POST /auth/forgot-password
Request a password reset email.

**Request Body:**
```json
{
  "email": "user@example.com"
}
```

**Response:** Always returns success (to prevent email enumeration)
```json
{
  "message": "If an account with that email exists, a password reset link has been sent."
}
```

---

### POST /auth/reset-password
Reset password using token from email.

**Request Body:**
```json
{
  "token": "reset-token-from-email",
  "newPassword": "newPassword123"
}
```

---

### POST /auth/get-security-question
Get security question for an account (for alternative recovery).

**Request Body:**
```json
{
  "email": "user@example.com"
}
```

**Response:**
```json
{
  "securityQuestion": "What was your first pet's name?"
}
```

---

### POST /auth/verify-security-answer
Verify security answer to get reset token.

**Request Body:**
```json
{
  "email": "user@example.com",
  "securityAnswer": "fluffy"
}
```

**Response:**
```json
{
  "message": "Security answer verified",
  "resetToken": "token-to-use-with-reset-password"
}
```

---

## Notes (Protected)

All notes endpoints require authentication.

**Headers:** `Authorization: Bearer <token>`

### GET /notes
Get all notes for the current user.

**Query Parameters (optional):**
- `contextType` - Filter by type: `team`, `fixture`, `player`, `league`, `betting`, `general`
- `contextId` - Filter by SportsMonks ID

**Response:**
```json
{
  "count": 5,
  "notes": [
    {
      "id": "uuid",
      "title": "Arsenal Form Analysis",
      "content": "Arsenal looking strong in home games...",
      "createdAt": "2025-01-11T12:00:00.000Z",
      "updatedAt": "2025-01-11T12:00:00.000Z",
      "links": [
        {
          "id": "uuid",
          "contextType": "team",
          "contextId": "19",
          "label": "Arsenal",
          "isPrimary": true
        }
      ]
    }
  ]
}
```

---

### GET /notes/:id
Get a single note by ID.

**Response:**
```json
{
  "note": {
    "id": "uuid",
    "title": "Arsenal Form Analysis",
    "content": "Arsenal looking strong...",
    "links": [...]
  }
}
```

---

### POST /notes
Create a new note.

**Request Body:**
```json
{
  "title": "Arsenal vs Chelsea Preview",
  "content": "Key matchup analysis...",
  "links": [
    {
      "contextType": "fixture",
      "contextId": "19134567",
      "label": "Arsenal vs Chelsea",
      "isPrimary": true
    },
    {
      "contextType": "team",
      "contextId": "19",
      "label": "Arsenal",
      "isPrimary": false
    }
  ]
}
```

**Notes:**
- At least one link required
- Exactly one link must have `isPrimary: true`
- `contextId` is optional (can tag with just category)

---

### PUT /notes/:id
Update a note.

**Request Body:**
```json
{
  "title": "Updated Title",      // Optional
  "content": "Updated content",  // Optional
  "links": [...]                 // Optional - replaces all existing links
}
```

---

### DELETE /notes/:id
Delete a note.

**Response:**
```json
{
  "message": "Note deleted successfully",
  "deletedNoteId": "uuid"
}
```

---

## Teams

All team endpoints are public (no authentication required).

### GET /teams/search/:query
Search for teams by name.

**Example:** `GET /teams/search/Arsenal`

**Response:**
```json
{
  "message": "Found 1 teams matching \"Arsenal\"",
  "teams": [
    {
      "id": 19,
      "name": "Arsenal",
      "short_code": "ARS",
      "image_path": "https://...",
      "country": { "name": "England" },
      "venue": { "name": "Emirates Stadium" }
    }
  ]
}
```

---

### GET /teams/:id
Get team details by ID.

**Example:** `GET /teams/19`

**Response:**
```json
{
  "team": {
    "id": 19,
    "name": "Arsenal",
    "short_code": "ARS",
    "image_path": "https://...",
    "country": { ... },
    "venue": { ... },
    "activeSeasons": [ ... ]
  }
}
```

---

### GET /teams/:id/stats
Get team with comprehensive statistics.

**Response includes:**
- Season statistics (wins, losses, draws)
- Goals scored/conceded
- Clean sheets
- Cards
- Coaches
- Sidelined players

---

### GET /teams/:id/stats/seasons/:seasonId
Get team statistics for a specific season.

**Example:** `GET /teams/19/stats/seasons/23614`

Useful for comparing stats across different seasons.

---

### GET /teams/h2h/:team1Id/:team2Id
Get head-to-head history between two teams.

**Example:** `GET /teams/h2h/19/11` (Arsenal vs Chelsea)

**Optional Includes:** `?include=odds,sidelined`

**Response:**
```json
{
  "message": "Found 42 head-to-head fixtures",
  "includes": { "odds": false, "sidelined": false },
  "summary": {
    "totalMatches": 42,
    "team1Wins": 18,
    "team2Wins": 15,
    "draws": 9
  },
  "fixtures": [...]
}
```

---

### GET /teams/:id/seasons
Get all seasons a team has participated in.

**Response:**
```json
{
  "message": "Found 25 seasons",
  "teamId": 19,
  "seasons": [
    {
      "id": 23614,
      "name": "2024/2025",
      "league": { "name": "Premier League" }
    }
  ]
}
```

---

### GET /teams/:id/squad
Get current squad (roster).

---

### GET /teams/:id/squad/seasons/:seasonId
Get historical squad for a specific season.

---

### GET /teams/:id/fullsquad/seasons/:seasonId
Get full squad with player statistics.

**Response includes for each player:**
- Goals, assists, appearances
- Yellow/red cards
- Minutes played
- Clean sheets (goalkeepers)

---

### GET /teams/:id/topstats/seasons/:seasonId
Get top 5 scorers and top 5 assist providers.

**Response:**
```json
{
  "teamId": 19,
  "seasonId": 23614,
  "topScorers": [
    { "playerId": 123, "name": "Bukayo Saka", "goals": 12 }
  ],
  "topAssists": [
    { "playerId": 456, "name": "Martin Odegaard", "assists": 8 }
  ]
}
```

---

### GET /teams/:id/corners/seasons/:seasonId
Get corner kick averages (calculated from historical fixtures).

**Response:**
```json
{
  "teamId": 19,
  "seasonId": 23614,
  "corners": {
    "home": { "total": 95, "games": 19, "average": 5.0 },
    "away": { "total": 57, "games": 17, "average": 3.4 },
    "overall": { "total": 152, "games": 36, "average": 4.2 }
  },
  "fromCache": true
}
```

---

### GET /teams/:id/transfers
Get transfer history.

---

### GET /teams/:id/schedule
Get full season schedule.

---

### GET /teams/coaches/search/:query
Search for coaches by name.

---

### GET /teams/coaches/:id
Get coach details.

---

## Fixtures

### GET /fixtures/:id
Get a single fixture with full details.

**Example:** `GET /fixtures/19134567`

**Optional Includes:** `?include=odds,sidelined`

**Response includes:**
- Participants (teams)
- Scores (current, halftime, penalties)
- Statistics (with `typeName` enriched)
- Events (goals, cards, subs - with `typeName`)
- Lineups
- Venue
- League and season info
- State (scheduled, live, finished)
- Sidelined players (if requested)
- Odds (if requested)

---

### GET /fixtures/date/:date
Get all fixtures on a specific date.

**Example:** `GET /fixtures/date/2025-01-11`

**Optional Includes:** `?include=odds,sidelined`

---

### GET /fixtures/between/:startDate/:endDate
Get fixtures within a date range.

**Example:** `GET /fixtures/between/2025-01-01/2025-01-31`

**Limit:** Maximum 100 days

---

### GET /fixtures/between/:startDate/:endDate/team/:teamId
Get fixtures for a specific team within a date range.

**Example:** `GET /fixtures/between/2024-08-01/2025-01-31/team/19`

No 100-day limit for team-specific queries.

---

### GET /fixtures/search/:query
Search fixtures by team name.

**Example:** `GET /fixtures/search/Arsenal`

---

### GET /fixtures/seasons/:seasonId
Get all stages with fixtures for a season.

Ideal for cup competitions (FA Cup, Carabao Cup).

**Response:**
```json
{
  "seasonId": 23768,
  "totalStages": 7,
  "totalFixtures": 125,
  "stages": [
    {
      "id": 123,
      "name": "First Round",
      "finished": true,
      "fixtures": [...]
    }
  ]
}
```

---

### GET /fixtures/:id/predictions
Get AI predictions for a fixture.

**Response:**
```json
{
  "fixtureId": 19134567,
  "fixtureName": "Arsenal vs Chelsea",
  "predictionsCount": 15,
  "predictions": [
    {
      "type_id": 123,
      "predictions": {
        "yes": 65.5,
        "no": 34.5
      }
    }
  ]
}
```

---

## Standings

### GET /standings/seasons/:seasonId
Get league table for a season.

**Example:** `GET /standings/seasons/23614`

**Response:**
```json
{
  "seasonId": 23614,
  "standings": [
    {
      "position": 1,
      "participant": {
        "id": 19,
        "name": "Arsenal",
        "image_path": "..."
      },
      "form": ["W", "W", "D", "W", "L"],
      "details": [
        { "type_id": 129, "value": 50 },  // Points
        { "type_id": 130, "value": 15 },  // Wins
        { "type_id": 133, "value": 45 }   // Goals For
      ]
    }
  ]
}
```

**Common Stat Type IDs:**
- 129: Points (P)
- 130: Wins (W)
- 131: Draws (D)
- 132: Losses (L)
- 133: Goals For (GF)
- 134: Goals Against (GA)
- 179: Goal Difference (GD)

---

## Leagues

### GET /leagues
Get all leagues in subscription.

### GET /leagues/:id
Get league details with seasons list.

### GET /leagues/search/:query
Search leagues by name.

---

## Seasons

### GET /seasons
Get all seasons.

### GET /seasons/:id
Get season details with stages.

### GET /seasons/leagues/:leagueId
Get all seasons for a specific league.

---

## Live Scores

### GET /livescores
Get all live/upcoming matches today.

### GET /livescores/inplay
Get only matches currently being played.

---

## Top Scorers

### GET /topscorers/seasons/:seasonId
Get goal scoring leaderboard for a season.

---

## Predictions

### GET /predictions/predictability/leagues/:leagueId
Get AI model performance/accuracy stats for a league.

**League IDs:**
- 8: Premier League
- 24: FA Cup
- 27: Carabao Cup

---

## Odds

### GET /odds/fixtures/:fixtureId
Get all pre-match odds for a fixture.

### GET /odds/fixtures/:fixtureId/bookmakers/:bookmakerId
Get odds filtered by bookmaker.

### GET /odds/fixtures/:fixtureId/markets/:marketId
Get odds filtered by market.

**Common Market IDs:**
- 1: Fulltime Result (1X2)
- 14: Both Teams To Score
- 18: Home Team Exact Goals
- 19: Away Team Exact Goals

### GET /odds/bookmakers
Get all available bookmakers.

### GET /odds/bookmakers/:id
Get bookmaker details.

### GET /odds/markets
Get all available betting markets.

### GET /odds/markets/:id
Get market details.

### GET /odds/markets/search/:query
Search markets by name.

---

## Players

### GET /players/search/:query
Search players by name.

### GET /players/:id
Get player details with stats.

---

## Admin (Protected)

Requires both authentication and admin privileges.

### POST /admin/types/sync 🔐👑
Sync SportsMonks types from API to local database.

**Headers:** `Authorization: Bearer <admin-token>`

**Response:**
```json
{
  "status": "ok",
  "message": "Types synced successfully",
  "result": {
    "totalFromAPI": 650,
    "inserted": 5,
    "updated": 645,
    "durationMs": 2500,
    "syncedAt": "2025-01-11T12:00:00.000Z"
  }
}
```

---

## Error Responses

All endpoints return consistent error format:

```json
{
  "error": "User-friendly error message",
  "details": "Technical details (development only)"
}
```

**Common HTTP Status Codes:**
- `400` - Bad Request (validation error)
- `401` - Unauthorized (missing/invalid token)
- `403` - Forbidden (not allowed)
- `404` - Not Found
- `500` - Server Error

---

## Legend

- 🔐 = Requires authentication (JWT token)
- 👑 = Requires admin privileges
