// ============================================
// STANDINGS PAGE
// ============================================
// Dedicated page for viewing competition standings/fixtures.
// 
// Includes:
// - Premier League table (LeagueStandings component)
// - FA Cup fixtures by round (CupCompetition component)
// - Carabao Cup fixtures by round (CupCompetition component)
//
// Features navigation buttons to jump between sections.
// ============================================

import { useRef } from 'react';
import LeagueStandings from '../components/LeagueStandings';
import CupCompetition from '../components/CupCompetition';

// ============================================
// LEAGUE/CUP IDS (SportsMonks)
// ============================================
const PREMIER_LEAGUE_ID = 8;
const FA_CUP_ID = 24;
const CARABAO_CUP_ID = 27;  // Also known as EFL Cup / League Cup

const Standings = () => {
  // ============================================
  // REFS FOR SMOOTH SCROLLING
  // ============================================
  const premierLeagueRef = useRef(null);
  const faCupRef = useRef(null);
  const carabaoCupRef = useRef(null);

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
  // RENDER
  // ============================================
  return (
    <div className="space-y-8">
      {/* Page Header */}
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Standings & Fixtures</h1>
        <p className="text-gray-600 mt-1">
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
          <div className="w-12 h-12 bg-white rounded-full flex items-center justify-center flex-shrink-0">
            <span className="text-purple-700 font-bold text-lg">PL</span>
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
          <div className="w-12 h-12 bg-white rounded-full flex items-center justify-center flex-shrink-0">
            <span className="text-red-700 font-bold text-lg">FA</span>
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
          <div className="w-12 h-12 bg-white rounded-full flex items-center justify-center flex-shrink-0">
            <span className="text-green-700 font-bold text-lg">CC</span>
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
          accentColor="green"
        />
      </div>
    </div>
  );
};

export default Standings;
