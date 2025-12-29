// ============================================
// API CLIENT
// ============================================
// Wrapper for making API calls to the BetSmoke backend.
// Handles base URL, headers, and token injection.
// ============================================

const API_BASE = 'http://localhost:3001';

// ============================================
// HELPER: Make a request
// ============================================

const request = async (method, path, data = null, token = null) => {
  const headers = {
    'Content-Type': 'application/json',
  };

  // Add auth token if provided
  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
  }

  const config = {
    method,
    headers,
  };

  // Add body for POST/PUT requests
  if (data && (method === 'POST' || method === 'PUT')) {
    config.body = JSON.stringify(data);
  }

  const response = await fetch(`${API_BASE}${path}`, config);
  const json = await response.json();

  // If response is not ok, throw error with message from API
  if (!response.ok) {
    throw new Error(json.error || 'Request failed');
  }

  return json;
};

// ============================================
// API METHODS
// ============================================

export const api = {
  // GET request (public)
  get: (path) => request('GET', path),

  // GET request (authenticated)
  getAuth: (path, token) => request('GET', path, null, token),

  // POST request (public)
  post: (path, data) => request('POST', path, data),

  // POST request (authenticated)
  postAuth: (path, data, token) => request('POST', path, data, token),

  // PUT request (authenticated)
  putAuth: (path, data, token) => request('PUT', path, data, token),

  // DELETE request (authenticated)
  deleteAuth: (path, token) => request('DELETE', path, null, token),
};

// ============================================
// AUTH API
// ============================================

export const authApi = {
  register: (email, password) => api.post('/auth/register', { email, password }),
  login: (email, password) => api.post('/auth/login', { email, password }),
  getMe: (token) => api.getAuth('/me', token),
};

// ============================================
// NOTES API
// ============================================

export const notesApi = {
  getAll: (token) => api.getAuth('/notes', token),
  getById: (id, token) => api.getAuth(`/notes/${id}`, token),
  create: (data, token) => api.postAuth('/notes', data, token),
  update: (id, data, token) => api.putAuth(`/notes/${id}`, data, token),
  delete: (id, token) => api.deleteAuth(`/notes/${id}`, token),
};

// ============================================
// PUBLIC DATA API (SportsMonks proxy)
// ============================================

export const dataApi = {
  // Teams
  searchTeams: (query) => api.get(`/teams/search/${encodeURIComponent(query)}`),
  getTeam: (id) => api.get(`/teams/${id}`),
  getTeamStats: (id) => api.get(`/teams/${id}/stats`),
  getTeamStatsBySeason: (teamId, seasonId) => api.get(`/teams/${teamId}/stats/seasons/${seasonId}`),
  getTeamSeasons: (id) => api.get(`/teams/${id}/seasons`),
  getHeadToHead: (team1Id, team2Id) => api.get(`/teams/h2h/${team1Id}/${team2Id}`),

  // Fixtures
  getFixturesByDate: (date) => api.get(`/fixtures/date/${date}`),
  getFixturesByDateRange: (startDate, endDate) => api.get(`/fixtures/between/${startDate}/${endDate}`),
  getTeamFixturesByDateRange: (startDate, endDate, teamId) => api.get(`/fixtures/between/${startDate}/${endDate}/team/${teamId}`),
  searchFixtures: (query) => api.get(`/fixtures/search/${encodeURIComponent(query)}`),
  // Get single fixture with optional includes
  // Always includes sidelined (injuries/suspensions) for betting research
  getFixture: (id, includeOdds = false) => {
    // Build includes array
    const includes = ['sidelined']; // Always include sidelined for betting research
    if (includeOdds) {
      includes.push('odds');
    }
    const params = `?include=${includes.join(',')}`;
    return api.get(`/fixtures/${id}${params}`);
  },

  // Odds
  getOddsByFixture: (fixtureId) => api.get(`/odds/fixtures/${fixtureId}`),
  getBookmakers: () => api.get('/odds/bookmakers'),
  getMarkets: () => api.get('/odds/markets'),

  // Standings
  getStandings: (seasonId) => api.get(`/standings/seasons/${seasonId}`),

  // Leagues
  getLeagues: () => api.get('/leagues'),
  getLeague: (id) => api.get(`/leagues/${id}`),

  // Seasons
  getSeasons: () => api.get('/seasons'),
  getSeasonsByLeague: (leagueId) => api.get(`/seasons/leagues/${leagueId}`),

  // Live scores
  getLivescores: () => api.get('/livescores'),

  // Top scorers
  getTopScorers: (seasonId) => api.get(`/topscorers/seasons/${seasonId}`),

  // Team top scorers & assists (for fixture details)
  getTeamTopStats: (teamId, seasonId) => api.get(`/teams/${teamId}/topstats/seasons/${seasonId}`),
  
  // Full squad with all player statistics (for team roster table)
  getTeamFullSquad: (teamId, seasonId) => api.get(`/teams/${teamId}/fullsquad/seasons/${seasonId}`),

  // Team stats (for scoring patterns, etc.)
  getTeamStats: (teamId) => api.get(`/teams/${teamId}/stats`),
  getTeamStatsBySeason: (teamId, seasonId) => api.get(`/teams/${teamId}/stats/seasons/${seasonId}`),

  // Predictions
  getPredictions: (fixtureId) => api.get(`/fixtures/${fixtureId}/predictions`),

  // Stages (for cup competitions - fixtures organized by stage/round)
  getStagesBySeason: (seasonId) => api.get(`/fixtures/seasons/${seasonId}`),

  // Corner averages (calculated from historical fixtures, cached 12h)
  // Returns home/away/overall corner averages for a team in a season
  getTeamCornerAverages: (teamId, seasonId) => api.get(`/teams/${teamId}/corners/seasons/${seasonId}`),
};

export default api;
