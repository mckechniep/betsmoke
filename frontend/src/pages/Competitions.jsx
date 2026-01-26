// ============================================
// COMPETITIONS PAGE
// ============================================
// Dedicated page for viewing all competition data.
// 
// Includes:
// - Premier League table (LeagueStandings component)
// - FA Cup fixtures by round (CupCompetition component)
// - Carabao Cup fixtures by round (CupCompetition component)
//
// Features navigation buttons to jump between sections.
// Fetches league logos from SportsMonks for display.
// ============================================

import { useRef, useState, useEffect } from 'react';
import LeagueStandings from '../components/LeagueStandings';
import CupCompetition from '../components/CupCompetition';
import { dataApi } from '../api/client';

// ============================================
// LEAGUE/CUP IDS (SportsMonks)
// ============================================
const PREMIER_LEAGUE_ID = 8;
const FA_CUP_ID = 24;
const CARABAO_CUP_ID = 27;  // Also known as EFL Cup / League Cup

const Competitions = () => {
  // ============================================
  // REFS FOR SMOOTH SCROLLING
  // ============================================
  const premierLeagueRef = useRef(null);
  const faCupRef = useRef(null);
  const carabaoCupRef = useRef(null);

  // ============================================
  // STATE FOR LEAGUE LOGOS
  // ============================================
  const [leagueLogos, setLeagueLogos] = useState({
    [PREMIER_LEAGUE_ID]: null,
    [FA_CUP_ID]: null,
    [CARABAO_CUP_ID]: null,
  });

  // ============================================
  // FETCH LEAGUE LOGOS ON MOUNT
  // ============================================
  useEffect(() => {
    const fetchLeagueLogos = async () => {
      try {
        // Fetch all three leagues in parallel
        const [plData, faData, ccData] = await Promise.all([
          dataApi.getLeague(PREMIER_LEAGUE_ID),
          dataApi.getLeague(FA_CUP_ID),
          dataApi.getLeague(CARABAO_CUP_ID),
        ]);

        // Extract image_path from each league response
        setLeagueLogos({
          [PREMIER_LEAGUE_ID]: plData.league?.image_path || null,
          [FA_CUP_ID]: faData.league?.image_path || null,
          [CARABAO_CUP_ID]: ccData.league?.image_path || null,
        });
      } catch (err) {
        console.error('Failed to fetch league logos:', err);
        // Keep nulls - components will show fallback
      }
    };

    fetchLeagueLogos();
  }, []);

  // ============================================
  // SCROLL TO SECTION
  // ============================================
  const scrollToSection = (ref) => {
    if (ref.current) {
      ref.current.scrollIntoView({ 
        behavior: 'smooth',
        block: 'start'
      });
    }
  };

  // ============================================
  // HELPER: Render logo or fallback
  // ============================================
  const renderLogo = (leagueId, fallbackText, colorClass) => {
    const logoUrl = leagueLogos[leagueId];

    if (logoUrl) {
      return (
        <img
          src={logoUrl}
          alt={fallbackText}
          className="w-12 h-12 md:w-10 md:h-10 object-contain"
        />
      );
    }

    // Fallback: show initials
    return (
      <span className={`${colorClass} font-bold text-xl md:text-lg`}>
        {fallbackText}
      </span>
    );
  };

  // ============================================
  // RENDER
  // ============================================
  return (
    <div className="space-y-8">
      {/* Page Header */}
      <div>
        <h1 className="text-2xl font-bold text-gray-100">Competitions</h1>
        <p className="text-gray-400 mt-1">
          View league tables and cup competition fixtures.
        </p>
      </div>

      {/* ============================================ */}
      {/* NAVIGATION BUTTONS */}
      {/* ============================================ */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {/* Premier League Button */}
        <button
          onClick={() => scrollToSection(premierLeagueRef)}
          className="flex items-center justify-center space-x-3 p-6 bg-gradient-to-r from-purple-600 to-purple-800 
                     rounded-lg shadow-md hover:shadow-lg hover:from-purple-700 hover:to-purple-900 
                     transition-all duration-200 group"
        >
          <div className="w-14 h-14 md:w-12 md:h-12 bg-white rounded-full flex items-center justify-center flex-shrink-0 p-1">
            {renderLogo(PREMIER_LEAGUE_ID, 'PL', 'text-purple-700')}
          </div>
          <div className="text-left">
            <h3 className="text-lg font-bold text-white group-hover:text-white/90">
              Premier League
            </h3>
            <p className="text-purple-200 text-sm">League Table</p>
          </div>
        </button>

        {/* FA Cup Button */}
        <button
          onClick={() => scrollToSection(faCupRef)}
          className="flex items-center justify-center space-x-3 p-6 bg-gradient-to-r from-red-600 to-red-800 
                     rounded-lg shadow-md hover:shadow-lg hover:from-red-700 hover:to-red-900 
                     transition-all duration-200 group"
        >
          <div className="w-14 h-14 md:w-12 md:h-12 bg-white rounded-full flex items-center justify-center flex-shrink-0 p-1">
            {renderLogo(FA_CUP_ID, 'FA', 'text-red-700')}
          </div>
          <div className="text-left">
            <h3 className="text-lg font-bold text-white group-hover:text-white/90">
              FA Cup
            </h3>
            <p className="text-red-200 text-sm">Fixtures by Round</p>
          </div>
        </button>

        {/* Carabao Cup Button */}
        <button
          onClick={() => scrollToSection(carabaoCupRef)}
          className="flex items-center justify-center space-x-3 p-6 bg-gradient-to-r from-green-600 to-green-800 
                     rounded-lg shadow-md hover:shadow-lg hover:from-green-700 hover:to-green-900 
                     transition-all duration-200 group"
        >
          <div className="w-14 h-14 md:w-12 md:h-12 bg-white rounded-full flex items-center justify-center flex-shrink-0 p-1">
            {renderLogo(CARABAO_CUP_ID, 'CC', 'text-green-700')}
          </div>
          <div className="text-left">
            <h3 className="text-lg font-bold text-white group-hover:text-white/90">
              Carabao Cup
            </h3>
            <p className="text-green-200 text-sm">Fixtures by Round</p>
          </div>
        </button>
      </div>

      {/* ============================================ */}
      {/* PREMIER LEAGUE STANDINGS */}
      {/* ============================================ */}
      <div ref={premierLeagueRef} className="scroll-mt-4">
        <LeagueStandings 
          leagueId={PREMIER_LEAGUE_ID} 
          leagueName="Premier League" 
          leagueLogo={leagueLogos[PREMIER_LEAGUE_ID]}
          showZones={true}
        />
      </div>

      {/* ============================================ */}
      {/* FA CUP FIXTURES */}
      {/* ============================================ */}
      <div ref={faCupRef} className="scroll-mt-4">
        <CupCompetition 
          leagueId={FA_CUP_ID}
          leagueName="FA Cup"
          leagueLogo={leagueLogos[FA_CUP_ID]}
          accentColor="red"
        />
      </div>

      {/* ============================================ */}
      {/* CARABAO CUP FIXTURES */}
      {/* ============================================ */}
      <div ref={carabaoCupRef} className="scroll-mt-4">
        <CupCompetition 
          leagueId={CARABAO_CUP_ID}
          leagueName="Carabao Cup"
          leagueLogo={leagueLogos[CARABAO_CUP_ID]}
          accentColor="green"
        />
      </div>
    </div>
  );
};

export default Competitions;
