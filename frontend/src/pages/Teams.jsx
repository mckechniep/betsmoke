// ============================================
// TEAMS PAGE
// ============================================

import { useState } from 'react';
import { Link } from 'react-router-dom';
import { dataApi } from '../api/client';

const Teams = () => {
  const [query, setQuery] = useState('');
  const [teams, setTeams] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [searched, setSearched] = useState(false);

  const handleSearch = async (e) => {
    e.preventDefault();

    if (!query.trim()) return;

    setLoading(true);
    setError('');
    setSearched(true);

    try {
      const data = await dataApi.searchTeams(query);
      setTeams(data.teams || []);
    } catch (err) {
      setError(err.message || 'Search failed');
      setTeams([]);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold text-gray-100">Teams</h1>

      <form onSubmit={handleSearch} className="flex gap-4">
        <input
          type="text"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search teams..."
          className="flex-1 px-3 py-2 border border-gray-600 rounded-md focus:outline-none focus:ring-2 focus:ring-amber-500"
        />
        <button
          type="submit"
          disabled={loading}
          className="bg-amber-500 text-gray-900 px-6 py-2 rounded-md hover:bg-amber-600 disabled:opacity-50"
        >
          {loading ? 'Searching...' : 'Search'}
        </button>
      </form>

      {error && (
        <div className="bg-red-900/30 text-red-400 p-3 rounded-md">
          {error}
        </div>
      )}

      {!searched ? (
        <div className="text-center py-12 text-gray-400">
          Search for a team to see results.
        </div>
      ) : loading ? (
        <div className="text-center py-12 text-gray-400">Searching...</div>
      ) : teams.length === 0 ? (
        <div className="text-center py-12 text-gray-400">
          No teams found for "{query}".
        </div>
      ) : (
        <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-4">
          {teams.map((team) => (
            <Link
              key={team.id}
              to={`/teams/${team.id}`}
              className="bg-gray-800 rounded-lg shadow-md p-4 hover:shadow-lg transition-shadow"
            >
              <div className="flex items-center space-x-4">
                {team.image_path && (
                  <img
                    src={team.image_path}
                    alt={team.name}
                    className="w-12 h-12 object-contain"
                  />
                )}
                <div>
                  <h3 className="font-semibold text-gray-100">{team.name}</h3>
                  <p className="text-sm text-gray-400">{team.country?.name}</p>
                </div>
              </div>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
};

export default Teams;
