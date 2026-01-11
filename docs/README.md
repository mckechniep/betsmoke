# BetSmoke 🔬⚽

A soccer betting **research application** that helps you make disciplined, explainable betting decisions by combining live football data with persistent personal notes.

> **Important**: BetSmoke does NOT place bets, handle odds calculations, process payments, or integrate with sportsbooks. It's a research tool to help you analyze matches before betting on external platforms.

---

## What is BetSmoke?

Think of BetSmoke as your **betting notebook + research terminal**. It gives you:

- **Live football data** from the SportsMonks API (fixtures, teams, standings, head-to-head stats)
- **Personal notes** tied to specific teams, fixtures, or betting strategies
- **AI predictions** with probability breakdowns for various markets
- **Historical analysis** including form, scoring patterns, and corner statistics

The goal is to help you research matches thoroughly and document your reasoning before placing bets elsewhere.

---

## Features

### 📊 Match Research
- Detailed fixture pages with team stats, form, and head-to-head history
- AI-powered predictions for common markets (1X2, BTTS, Over/Under, Corners)
- Sidelined players (injuries/suspensions) for each team
- Scoring patterns by time period (0-15min, 16-30min, etc.)

### 🏟️ Team Analysis
- Full season statistics (wins, draws, losses, goals, clean sheets)
- Squad roster with player stats (goals, assists, appearances)
- Corner averages (home/away breakdown)
- Historical fixture results

### 🏆 Competitions
- **Premier League** - Full standings, fixtures, and team data
- **FA Cup** - Knockout stages with fixtures by round
- **Carabao Cup** - Cup competition fixture tracking

### 📝 Personal Notes
- Create notes tied to teams, fixtures, players, or general strategies
- Tag notes with multiple categories
- Search and filter your research history
- Review past reasoning before making new bets

### 🔐 User Accounts
- Secure authentication with JWT tokens
- User preferences (odds format: American/Decimal/Fractional, timezone)
- Password recovery via email or security question

---

## Tech Stack

### Backend
- **Node.js** + **Express** - API server
- **PostgreSQL** - Database for user data and notes
- **Prisma** - ORM and migrations
- **JWT** - Authentication

### Frontend
- **React 19** - UI components
- **Tailwind CSS** - Styling
- **Vite** - Build tool
- **React Router** - Navigation

### External Data
- **SportsMonks API** - Live football data (fixtures, teams, standings, predictions)

---

## Getting Started

### Prerequisites
- Node.js 18+
- Docker (for PostgreSQL)
- SportsMonks API key ([get one here](https://www.sportmonks.com/football-api/))

### 1. Clone and Install

```bash
# Clone the repository
git clone https://github.com/your-username/betsmoke.git
cd betsmoke

# Install backend dependencies
npm install

# Install frontend dependencies
cd frontend
npm install
cd ..
```

### 2. Environment Setup

Create a `.env` file in the root directory:

```env
# Database (Docker will use these)
DATABASE_URL="postgresql://postgres:postgres@localhost:5432/betsmoke"

# JWT Secret (generate a random string)
JWT_SECRET="your-super-secret-key-change-this"

# SportsMonks API
SPORTSMONKS_API_KEY="your-sportsmonks-api-key"

# Email (optional - for password recovery)
MAILJET_API_KEY="your-mailjet-api-key"
MAILJET_SECRET_KEY="your-mailjet-secret"
EMAIL_FROM="noreply@yourdomain.com"
```

### 3. Start the Database

```bash
# Start PostgreSQL with Docker
docker-compose up -d

# Run database migrations
npx prisma migrate dev
```

### 4. Sync SportsMonks Types (First Time Only)

The app stores SportsMonks type definitions locally for fast lookups. After starting the server, you'll need to sync these once:

```bash
# Start the backend first (see step 5)
# Then call the admin sync endpoint (requires admin user)
# Or manually run: npx prisma db seed (if seed script is set up)
```

### 5. Start the Application

```bash
# Terminal 1 - Backend (from root directory)
npm run dev

# Terminal 2 - Frontend (from frontend directory)
cd frontend
npm run dev
```

The app will be available at:
- **Frontend**: http://localhost:5173
- **Backend API**: http://localhost:3001

---

## Usage

### Creating an Account
1. Go to `/register`
2. Enter your email and password
3. (Optional) Set your preferred odds format and timezone
4. (Optional) Add a security question for account recovery

### Researching a Match
1. Go to **Fixtures** to see upcoming matches
2. Click on a match to see the **Fixture Detail** page
3. Review:
   - Team form (last 5 matches)
   - Head-to-head history
   - AI predictions with probabilities
   - Sidelined players (injuries/suspensions)
   - Scoring patterns by time period

### Creating Notes
1. Log in to your account
2. Go to **Notes** → **New Note**
3. Give your note a title and content
4. Link it to a team, fixture, or category
5. Save for future reference

---

## Project Structure

```
betsmoke/
├── src/                    # Backend source code
│   ├── index.js           # Express app entry point
│   ├── routes/            # API route handlers
│   ├── services/          # Business logic (SportsMonks, cache, types)
│   ├── middleware/        # Auth middleware
│   └── db.js              # Prisma client
├── frontend/              # React frontend
│   ├── src/
│   │   ├── pages/         # Page components
│   │   ├── components/    # Reusable UI components
│   │   ├── context/       # React context (auth)
│   │   └── api/           # API client
├── prisma/                # Database schema and migrations
├── docs/                  # Documentation
└── docker-compose.yml     # PostgreSQL container config
```

---

## Documentation

- [Architecture Overview](./ARCHITECTURE.md) - How the system is designed
- [API Reference](./API.md) - All backend endpoints documented
- [SportsMonks Integration](./SPORTSMONKS.md) - API patterns and best practices

---

## Contributing

This is a personal project, but suggestions are welcome! Feel free to open an issue to discuss improvements.

---

## License

MIT License - see [LICENSE](../LICENSE) for details.

---

## Disclaimer

BetSmoke is a research tool only. It does not encourage gambling and provides no guarantees about betting outcomes. Always bet responsibly and within your means.
