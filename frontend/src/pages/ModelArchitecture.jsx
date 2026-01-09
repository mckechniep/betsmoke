// ============================================
// MODEL ARCHITECTURE PAGE
// ============================================
// Explains how the SportsMonks AI prediction model works,
// including data inputs, algorithms used, and known limitations.
// ============================================

import { useState } from 'react';

// ============================================
// HELPER COMPONENTS
// ============================================

/**
 * Expandable Section - Click to expand/collapse content
 * Used for Data Inputs, Algorithms, and Limitations sections
 */
const ExpandableSection = ({ title, isExpanded, onToggle, children }) => {
  return (
    <div className="border border-blue-200 rounded-lg overflow-hidden">
      {/* Clickable Header */}
      <button
        onClick={onToggle}
        className="w-full px-4 py-3 bg-white/70 hover:bg-white/90 flex items-center justify-between text-left transition-colors"
      >
        <span className="font-medium text-blue-800">{title}</span>
        <span className="text-blue-600 text-lg">
          {isExpanded ? '▼' : '▶'}
        </span>
      </button>
      
      {/* Collapsible Content */}
      {isExpanded && (
        <div className="px-4 py-3 bg-white/50 border-t border-blue-200">
          {children}
        </div>
      )}
    </div>
  );
};

// ============================================
// MAIN COMPONENT
// ============================================

const ModelArchitecture = () => {
  // ============================================
  // STATE
  // ============================================
  
  // Each expandable section can be independently expanded/collapsed
  const [expandedSections, setExpandedSections] = useState({
    dataInputs: false,
    algorithms: false,
    limitations: false,
  });

  // Toggle expandable section
  const toggleSection = (section) => {
    setExpandedSections(prev => ({
      ...prev,
      [section]: !prev[section],
    }));
  };

  // ============================================
  // RENDER
  // ============================================
  
  return (
    <div className="space-y-6">
      {/* ============================================ */}
      {/* HEADER */}
      {/* ============================================ */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Model Architecture</h1>
          <p className="text-sm text-gray-500 mt-1">
            Learn how our AI prediction model works under the hood
          </p>
        </div>
      </div>

      {/* ============================================ */}
      {/* HOW IT WORKS CARD */}
      {/* ============================================ */}
      <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
        <h3 className="font-semibold text-blue-900 mb-2">🤖 AI Predictions: How it Works</h3>
        <div className="text-sm text-blue-800 space-y-3">
          <p>
            We're using a state-of-the-art, AI-driven Predictions API from SportsMonks, a leading football data platform.
          </p>
          <p>
            The Predictions API leverages advanced machine learning algorithms to forecast match outcomes with data-backed precision.
          </p>
          <p>
            The model analyzes team dynamics, historical performance, player contributions, head-to-head records, 
            current form, and dozens of other factors to generate probability-based predictions across multiple betting markets.
          </p>
          
          {/* Expandable Sections */}
          <div className="space-y-2 mt-3">
            {/* Data Inputs */}
            <ExpandableSection
              title="Data Inputs"
              isExpanded={expandedSections.dataInputs}
              onToggle={() => toggleSection('dataInputs')}
            >
              <ul className="list-disc list-inside space-y-1 text-blue-700 text-xs">
                <li><strong>Event data</strong> — Passes, shots, fouls, timestamps, pitch coordinates</li>
                <li><strong>Player & team metadata</strong> — Age, height, experience, injury history, team value</li>
                <li><strong>Match context</strong> — Home/away, rest days, weather, referee</li>
                <li><strong>Advanced metrics</strong> — xG (Expected Goals), xGA, xThreat, xPoints</li>
                <li><strong>External signals</strong> — Betting market odds, recent form</li>
              </ul>
            </ExpandableSection>
            
            {/* Algorithms Used */}
            <ExpandableSection
              title="Algorithms Used"
              isExpanded={expandedSections.algorithms}
              onToggle={() => toggleSection('algorithms')}
            >
              <ul className="list-disc list-inside space-y-1 text-blue-700 text-xs">
                <li><strong>Poisson regression</strong> — Models goal scoring as random events based on team strength</li>
                <li><strong>Dixon & Coles model</strong> — Adjusts for low-scoring games (0-0, 1-1)</li>
                <li><strong>Gradient boosting</strong> — XGBoost, LightGBM for complex pattern detection</li>
                <li><strong>Neural networks</strong> — For sequential and spatial data analysis</li>
                <li><strong>Ensemble methods</strong> — Combines multiple models for more robust predictions</li>
              </ul>
            </ExpandableSection>
            
            {/* Known Limitations */}
            <ExpandableSection
              title="Known Limitations"
              isExpanded={expandedSections.limitations}
              onToggle={() => toggleSection('limitations')}
            >
              <ul className="list-disc list-inside space-y-1 text-blue-700 text-xs">
                <li><strong>High randomness</strong> — Goals are rare events; deflections, referee decisions, and luck create noise</li>
                <li><strong>Small sample sizes</strong> — Individual player data can be too limited for reliable estimates</li>
                <li><strong>Shifting conditions</strong> — Transfers, injuries, and managerial changes mean past data may not predict future</li>
                <li><strong>Unobserved factors</strong> — Team motivation, morale, and psychological pressure can't be measured</li>
              </ul>
            </ExpandableSection>
          </div>
          
          <p className="text-blue-600 text-xs mt-3">
            Source: <a href="https://www.sportmonks.com/glossary/algorithm-predictive-modeling/" 
              target="_blank" rel="noopener noreferrer" className="underline hover:text-blue-800">
              SportsMonks - Algorithm (Predictive Modeling)
            </a>
          </p>
        </div>
      </div>
    </div>
  );
};

export default ModelArchitecture;
