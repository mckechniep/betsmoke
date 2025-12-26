// ============================================
// STANDINGS PAGE
// ============================================

import { useState, useEffect } from 'react';
import { dataApi } from '../api/client';

const Standings = () => {
  const [seasons, setSeasons] = useState([]);
  const [selectedSeason, setSelectedSeason] = useState('');
  const [standings, setStandings] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [seasonsLoading, setSeasonsLoading] = useState(true);

  // Fetch available seasons on mount
  useEffect(() => {
    const fetchSeasons = async () => {
      try {
        const data = await dataApi.getSeasons();
        // Filter to current/recent seasons
        const sortedSeasons = (data.seasons || [])
          .filter(s => s.is_current || s.name?.includes('2024') || s.name?.includes('2025'))
          .sort((a, b) => b.name?.localeCompare(a.name));
        setSeasons(sortedSeasons);
        if (sortedSeasons.length > 0) {
          setSelectedSeason(sortedSeasons[0].id.toString());
        }
      } catch (err) {
        setError('Failed to load seasons');
      } finally {
        setSeasonsLoading(false);
      }
    };

    fetchSeasons();
  }, []);

  // Fetch standings when season changes
  useEffect(() => {
    if (!selectedSeason) return;

    const fetchStandings = async () => {
      setLoading(true);
      setError('');

      try {
        const data = await dataApi.getStandings(selectedSeason);
        setStandings(data.standings || []);
      } catch (err) {
        setError(err.message || 'Failed to load standings');
        setStandings([]);
      } finally {
        setLoading(false);
      }
    };

    fetchStandings();
  }, [selectedSeason]);

  const getSelectedSeasonName = () => {
    const season = seasons.find(s => s.id.toString() === selectedSeason);
    return season ? `${season.league?.name} - ${season.name}` : '';
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-gray-900">Standings</h1>

        {seasonsLoading ? (
          <div className="text-gray-500">Loading seasons...</div>
        ) : (
          <select
            value={selectedSeason}
            onChange={(e) => setSelectedSeason(e.target.value)}
            className="px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
          >
            {seasons.map((season) => (
              <option key={season.id} value={season.id}>
                {season.league?.name} - {season.name}
              </option>
            ))}
          </select>
        )}
      </div>

      {error && (
        <div className="bg-red-50 text-red-600 p-3 rounded-md">{error}</div>
      )}

      {loading ? (
        <div className="text-center py-12 text-gray-500">Loading standings...</div>
      ) : standings.length === 0 ? (
        <div className="text-center py-12 text-gray-500">
          No standings available for this season.
        </div>
      ) : (
        <div className="bg-white rounded-lg shadow-md overflow-hidden">
          <div className="px-4 py-3 bg-gray-50 border-b">
            <h2 className="font-semibold">{getSelectedSeasonName()}</h2>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-gray-50 text-sm text-gray-500">
                <tr>
                  <th className="px-4 py-3 text-left">#</th>
                  <th className="px-4 py-3 text-left">Team</th>
                  <th className="px-4 py-3 text-center">P</th>
                  <th className="px-4 py-3 text-center">W</th>
                  <th className="px-4 py-3 text-center">D</th>
                  <th className="px-4 py-3 text-center">L</th>
                  <th className="px-4 py-3 text-center">GF</th>
                  <th className="px-4 py-3 text-center">GA</th>
                  <th className="px-4 py-3 text-center">GD</th>
                  <th className="px-4 py-3 text-center">Pts</th>
                  <th className="px-4 py-3 text-center">Form</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200">
                {standings.map((row) => (
                  <tr key={row.participant_id} className="hover:bg-gray-50">
                    <td className="px-4 py-3 text-sm font-medium">
                      {row.position}
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center space-x-2">
                        {row.participant?.image_path && (
                          <img
                            src={row.participant.image_path}
                            alt=""
                            className="w-6 h-6 object-contain"
                          />
                        )}
                        <span className="font-medium text-sm">
                          {row.participant?.name}
                        </span>
                      </div>
                    </td>
                    <td className="px-4 py-3 text-center text-sm">
                      {row.details?.find(d => d.type_id === 129)?.value ?? '-'}
                    </td>
                    <td className="px-4 py-3 text-center text-sm">
                      {row.details?.find(d => d.type_id === 130)?.value ?? '-'}
                    </td>
                    <td className="px-4 py-3 text-center text-sm">
                      {row.details?.find(d => d.type_id === 131)?.value ?? '-'}
                    </td>
                    <td className="px-4 py-3 text-center text-sm">
                      {row.details?.find(d => d.type_id === 132)?.value ?? '-'}
                    </td>
                    <td className="px-4 py-3 text-center text-sm">
                      {row.details?.find(d => d.type_id === 133)?.value ?? '-'}
                    </td>
                    <td className="px-4 py-3 text-center text-sm">
                      {row.details?.find(d => d.type_id === 134)?.value ?? '-'}
                    </td>
                    <td className="px-4 py-3 text-center text-sm">
                      {row.details?.find(d => d.type_id === 179)?.value ?? '-'}
                    </td>
                    <td className="px-4 py-3 text-center text-sm font-bold">
                      {row.points}
                    </td>
                    <td className="px-4 py-3 text-center">
                      <div className="flex justify-center space-x-1">
                        {row.form && row.form.length > 0 ? (
                          [...row.form]
                            .sort((a, b) => b.sort_order - a.sort_order)
                            .slice(0, 5)
                            .reverse()
                            .map((match, idx) => (
                              <span
                                key={idx}
                                className={`
                                  w-6 h-6 flex items-center justify-center rounded text-xs font-bold text-white
                                  ${match.form === 'W' ? 'bg-green-500' : ''}
                                  ${match.form === 'D' ? 'bg-gray-400' : ''}
                                  ${match.form === 'L' ? 'bg-red-500' : ''}
                                `}
                              >
                                {match.form}
                              </span>
                            ))
                        ) : (
                          <span className="text-gray-400">-</span>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
};

export default Standings;
