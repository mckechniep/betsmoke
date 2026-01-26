// ============================================
// NOTES PAGE
// ============================================
// Full notes management with:
// - Search (searches title, content, and link labels)
// - Filter by link type
// - Create new notes
// - Edit existing notes
// - Delete notes
// ============================================

import { useState, useEffect, useMemo } from 'react';
import { Link } from 'react-router-dom';
import { DragDropContext, Droppable, Draggable } from '@hello-pangea/dnd';
import { useAuth } from '../context/AuthContext';
import { notesApi, dataApi } from '../api/client';
import AppIcon from '../components/AppIcon';

// ============================================
// CONSTANTS
// ============================================
const MAX_LINKS = 6;  // Maximum links per note (1 primary + up to 5 secondary)

const CONTEXT_TYPES = [
  { value: 'all', label: 'All Types', iconName: 'note' },
  { value: 'fixture', label: 'Matches', iconName: 'soccer-ball' },
  { value: 'team', label: 'Teams', iconName: 'team' },
  { value: 'player', label: 'Players', iconName: 'player' },
  { value: 'league', label: 'Competitions', iconName: 'trophy' },
  { value: 'betting', label: 'Betting', iconName: 'money' },
  { value: 'general', label: 'General', iconName: 'notes' },
];

// ============================================
// HELPER: Get icon name for context type
// ============================================
const getContextIconName = (contextType) => {
  const found = CONTEXT_TYPES.find(t => t.value === contextType);
  return found?.iconName || 'note';
};

// ============================================
// HELPER: Format date
// ============================================
const formatDate = (dateString) => {
  return new Date(dateString).toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit'
  });
};

// ============================================
// TEAM SEARCH INPUT COMPONENT
// ============================================
// Autocomplete search for teams from the SportsMonks API
// - Debounces user input to avoid excessive API calls
// - Shows dropdown of matching teams
// - Returns both team ID (contextId) and name (label)
const TeamSearchInput = ({ onSelect, placeholder = 'Search for a team...' }) => {
  const [query, setQuery] = useState('');
  const [results, setResults] = useState([]);
  const [isLoading, setIsLoading] = useState(false);
  const [showDropdown, setShowDropdown] = useState(false);
  const [error, setError] = useState('');

  // Debounced search function
  useEffect(() => {
    // Don't search if query is too short
    if (query.trim().length < 2) {
      setResults([]);
      setShowDropdown(false);
      return;
    }

    // Set up debounce timer
    const timer = setTimeout(async () => {
      setIsLoading(true);
      setError('');
      
      try {
        const response = await dataApi.searchTeams(query.trim());
        // Extract teams array from response
        const teams = response?.teams || response?.data || [];
        setResults(teams.slice(0, 10)); // Limit to 10 results
        setShowDropdown(true);
      } catch (err) {
        console.error('Team search error:', err);
        setError('Failed to search teams');
        setResults([]);
      } finally {
        setIsLoading(false);
      }
    }, 300); // 300ms debounce

    // Cleanup: cancel timer if user keeps typing
    return () => clearTimeout(timer);
  }, [query]);

  // Handle team selection
  const handleSelect = (team) => {
    onSelect({
      contextId: String(team.id),  // SportsMonks team ID
      label: team.name              // Team name for display
    });
    setQuery(team.name);  // Show selected team name in input
    setShowDropdown(false);
  };

  // Handle clicking outside to close dropdown
  const handleBlur = () => {
    // Small delay to allow click on dropdown item
    setTimeout(() => setShowDropdown(false), 150);
  };

  return (
    <div className="relative flex-1">
      <input
        type="text"
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        onFocus={() => results.length > 0 && setShowDropdown(true)}
        onBlur={handleBlur}
        placeholder={placeholder}
        className="w-full px-2 py-1 text-xs border border-gray-600 rounded focus:outline-none focus:ring-1 focus:ring-amber-500"
        autoFocus
      />
      
      {/* Loading indicator */}
      {isLoading && (
        <div className="absolute right-2 top-1/2 -translate-y-1/2">
          <div className="w-3 h-3 border-2 border-amber-500 border-t-transparent rounded-full animate-spin" />
        </div>
      )}
      
      {/* Dropdown results */}
      {showDropdown && results.length > 0 && (
        <div className="absolute z-50 w-full mt-1 bg-gray-800 border border-gray-600 rounded-md shadow-lg max-h-48 overflow-y-auto">
          {results.map((team) => (
            <button
              key={team.id}
              type="button"
              onClick={() => handleSelect(team)}
              className="w-full px-3 py-2 text-left text-xs hover:bg-gray-700 flex items-center gap-2"
            >
              {/* Team logo if available */}
              {team.image_path && (
                <img 
                  src={team.image_path} 
                  alt="" 
                  className="w-5 h-5 object-contain"
                  onError={(e) => e.target.style.display = 'none'}
                />
              )}
              <span>{team.name}</span>
            </button>
          ))}
        </div>
      )}
      
      {/* No results message */}
      {showDropdown && query.length >= 2 && !isLoading && results.length === 0 && (
        <div className="absolute z-50 w-full mt-1 bg-gray-800 border border-gray-600 rounded-md shadow-lg p-2 text-xs text-gray-400">
          No teams found for "{query}"
        </div>
      )}
      
      {/* Error message */}
      {error && (
        <div className="absolute z-50 w-full mt-1 bg-red-50 border border-red-700 rounded-md p-2 text-xs text-red-600">
          {error}
        </div>
      )}
    </div>
  );
};

// ============================================
// LEAGUE SEARCH INPUT COMPONENT
// ============================================
// Autocomplete search for leagues from the SportsMonks API
// - Debounces user input to avoid excessive API calls
// - Shows dropdown of matching leagues
// - Returns both league ID (contextId) and name (label)
const LeagueSearchInput = ({ onSelect, placeholder = 'Search for a league...' }) => {
  const [query, setQuery] = useState('');
  const [results, setResults] = useState([]);
  const [isLoading, setIsLoading] = useState(false);
  const [showDropdown, setShowDropdown] = useState(false);
  const [error, setError] = useState('');

  // Debounced search function
  useEffect(() => {
    // Don't search if query is too short
    if (query.trim().length < 2) {
      setResults([]);
      setShowDropdown(false);
      return;
    }

    // Set up debounce timer
    const timer = setTimeout(async () => {
      setIsLoading(true);
      setError('');
      
      try {
        const response = await dataApi.searchLeagues(query.trim());
        // Extract leagues array from response
        const leagues = response?.leagues || response?.data || [];
        setResults(leagues.slice(0, 10)); // Limit to 10 results
        setShowDropdown(true);
      } catch (err) {
        console.error('League search error:', err);
        setError('Failed to search leagues');
        setResults([]);
      } finally {
        setIsLoading(false);
      }
    }, 300); // 300ms debounce

    // Cleanup: cancel timer if user keeps typing
    return () => clearTimeout(timer);
  }, [query]);

  // Handle league selection
  const handleSelect = (league) => {
    onSelect({
      contextId: String(league.id),  // SportsMonks league ID
      label: league.name              // League name for display
    });
    setQuery(league.name);  // Show selected league name in input
    setShowDropdown(false);
  };

  // Handle clicking outside to close dropdown
  const handleBlur = () => {
    // Small delay to allow click on dropdown item
    setTimeout(() => setShowDropdown(false), 150);
  };

  return (
    <div className="relative flex-1">
      <input
        type="text"
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        onFocus={() => results.length > 0 && setShowDropdown(true)}
        onBlur={handleBlur}
        placeholder={placeholder}
        className="w-full px-2 py-1 text-xs border border-gray-600 rounded focus:outline-none focus:ring-1 focus:ring-amber-500"
        autoFocus
      />
      
      {/* Loading indicator */}
      {isLoading && (
        <div className="absolute right-2 top-1/2 -translate-y-1/2">
          <div className="w-3 h-3 border-2 border-amber-500 border-t-transparent rounded-full animate-spin" />
        </div>
      )}
      
      {/* Dropdown results */}
      {showDropdown && results.length > 0 && (
        <div className="absolute z-50 w-full mt-1 bg-gray-800 border border-gray-600 rounded-md shadow-lg max-h-48 overflow-y-auto">
          {results.map((league) => (
            <button
              key={league.id}
              type="button"
              onClick={() => handleSelect(league)}
              className="w-full px-3 py-2 text-left text-xs hover:bg-gray-700 flex items-center gap-2"
            >
              {/* League logo if available */}
              {league.image_path && (
                <img 
                  src={league.image_path} 
                  alt="" 
                  className="w-5 h-5 object-contain"
                  onError={(e) => e.target.style.display = 'none'}
                />
              )}
              <span>{league.name}</span>
              {/* Show country if available */}
              {league.country?.name && (
                <span className="text-gray-400">({league.country.name})</span>
              )}
            </button>
          ))}
        </div>
      )}
      
      {/* No results message */}
      {showDropdown && query.length >= 2 && !isLoading && results.length === 0 && (
        <div className="absolute z-50 w-full mt-1 bg-gray-800 border border-gray-600 rounded-md shadow-lg p-2 text-xs text-gray-400">
          No leagues found for "{query}"
        </div>
      )}
      
      {/* Error message */}
      {error && (
        <div className="absolute z-50 w-full mt-1 bg-red-50 border border-red-700 rounded-md p-2 text-xs text-red-600">
          {error}
        </div>
      )}
    </div>
  );
};

// ============================================
// LINK TAG COMPONENT (for display and editing)
// ============================================
// Displays a link as a pill/badge
// - Shows icon + category name (e.g., "🛡️ Teams")
// - If label or contextId exists, shows it in parentheses (e.g., "🛡️ Teams (Arsenal)")
// - Primary links have blue styling, others are gray
const LinkTag = ({ link, isPrimary, onRemove, onSetPrimary, editable = false }) => {
  // Find the human-readable label for this context type
  const typeInfo = CONTEXT_TYPES.find(t => t.value === link.contextType);
  const typeLabel = typeInfo?.label || link.contextType;
  
  // Use label if available, otherwise fall back to contextId
  // label = friendly name (e.g., "Arsenal")
  // contextId = ID or user-typed value (e.g., "19" or "Arsenal")
  const specificValue = link.label || link.contextId;
  
  // Build display: "Category" or "Category (specific)"
  const displayLabel = specificValue 
    ? `${typeLabel} (${specificValue})`  // Has specific value
    : typeLabel;                          // Category only
  
  return (
    <span 
      className={`inline-flex items-center rounded-full text-xs font-medium
        ${isPrimary 
          ? 'bg-amber-900/30 text-amber-400' 
          : 'bg-gray-700 text-gray-400'
        }`}
    >
      {editable && onSetPrimary && (
        <button
          type="button"
          onClick={() => onSetPrimary(link)}
          className={`px-1.5 py-0.5 rounded-l-full transition-colors
            ${isPrimary ? 'text-amber-500' : 'text-gray-400 hover:text-yellow-500'}`}
          title={isPrimary ? 'Primary link' : 'Set as primary'}
        >
          {isPrimary ? '★' : '☆'}
        </button>
      )}
      
      <span className={`py-0.5 ${editable ? '' : 'px-2'} flex items-center gap-1`}>
        <AppIcon name={getContextIconName(link.contextType)} size="xs" className="text-gray-400" />
        <span>{displayLabel}</span>
      </span>
      
      {editable && onRemove && (
        <button
          type="button"
          onClick={() => onRemove(link)}
          className="px-1.5 py-0.5 rounded-r-full hover:bg-red-200 hover:text-red-600 transition-colors"
          title="Remove link"
        >
          ×
        </button>
      )}
      
      {!editable && <span className="pr-0.5" />}
    </span>
  );
};

// ============================================
// DRAGGABLE LINK LIST COMPONENT
// ============================================
// Vertical list of links that can be reordered via drag-and-drop
// - First link is always PRIMARY (shown with filled star)
// - Click empty star to snap that link to top (make primary)
// - Drag handle on left for reordering
// - Remove button on right
const DraggableLinkList = ({ links, onReorder, onRemove, onMakePrimary }) => {
  
  // Handle drag end - reorder the links array
  const handleDragEnd = (result) => {
    // Dropped outside the list
    if (!result.destination) return;
    
    // No movement
    if (result.destination.index === result.source.index) return;
    
    // Reorder the array
    const reordered = Array.from(links);
    const [removed] = reordered.splice(result.source.index, 1);
    reordered.splice(result.destination.index, 0, removed);
    
    onReorder(reordered);
  };
  
  // Click star to move link to top (make primary)
  const handleStarClick = (index) => {
    if (index === 0) return; // Already primary
    
    const reordered = Array.from(links);
    const [removed] = reordered.splice(index, 1);
    reordered.unshift(removed); // Add to beginning
    
    onMakePrimary(reordered);
  };
  
  // Get display label for a link
  const getDisplayLabel = (link) => {
    const typeInfo = CONTEXT_TYPES.find(t => t.value === link.contextType);
    const typeLabel = typeInfo?.label || link.contextType;
    const specificValue = link.label || link.contextId;
    
    return specificValue 
      ? `${typeLabel} (${specificValue})`
      : typeLabel;
  };
  
  if (links.length === 0) {
    return (
      <div className="p-4 bg-gray-700 rounded-md text-center text-sm text-gray-400">
        No links yet - add at least one
      </div>
    );
  }
  
  return (
    <DragDropContext onDragEnd={handleDragEnd}>
      <Droppable droppableId="links-list">
        {(provided, snapshot) => (
          <div
            ref={provided.innerRef}
            {...provided.droppableProps}
            className={`rounded-md border transition-colors ${
              snapshot.isDraggingOver 
                ? 'bg-blue-900/30 border-blue-700' 
                : 'bg-gray-700 border-gray-700'
            }`}
          >
            {links.map((link, index) => {
              const isPrimary = index === 0;
              const linkId = link.tempId || link.id || `link-${index}`;
              
              return (
                <Draggable 
                  key={linkId} 
                  draggableId={String(linkId)} 
                  index={index}
                >
                  {(provided, snapshot) => (
                    <div
                      ref={provided.innerRef}
                      {...provided.draggableProps}
                      className={`flex items-center gap-2 px-3 py-2 border-b last:border-b-0 transition-colors ${
                        snapshot.isDragging 
                          ? 'bg-gray-800 shadow-lg rounded-md border-blue-300' 
                          : isPrimary 
                            ? 'bg-blue-900/30' 
                            : 'bg-gray-800 hover:bg-gray-700'
                      }`}
                    >
                      {/* Drag handle */}
                      <div 
                        {...provided.dragHandleProps}
                        className="cursor-grab active:cursor-grabbing text-gray-400 hover:text-gray-400"
                        title="Drag to reorder"
                      >
                        <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
                          <path d="M7 2a2 2 0 1 0 0 4 2 2 0 0 0 0-4zM7 8a2 2 0 1 0 0 4 2 2 0 0 0 0-4zM7 14a2 2 0 1 0 0 4 2 2 0 0 0 0-4zM13 2a2 2 0 1 0 0 4 2 2 0 0 0 0-4zM13 8a2 2 0 1 0 0 4 2 2 0 0 0 0-4zM13 14a2 2 0 1 0 0 4 2 2 0 0 0 0-4z" />
                        </svg>
                      </div>
                      
                      {/* Star (primary indicator / make primary button) */}
                      <button
                        type="button"
                        onClick={() => handleStarClick(index)}
                        disabled={isPrimary}
                        className={`text-lg leading-none transition-colors ${
                          isPrimary 
                            ? 'text-yellow-500 cursor-default' 
                            : 'text-gray-300 hover:text-yellow-400 cursor-pointer'
                        }`}
                        title={isPrimary ? 'Primary link' : 'Click to make primary'}
                      >
                        {isPrimary ? '★' : '☆'}
                      </button>
                      
                      {/* Link content */}
                      <div className="flex-1 flex items-center gap-1.5 min-w-0">
                        <AppIcon name={getContextIconName(link.contextType)} size="sm" className="text-gray-400" />
                        <span className={`text-sm truncate ${
                          isPrimary ? 'font-medium text-amber-400' : 'text-gray-300'
                        }`}>
                          {getDisplayLabel(link)}
                        </span>
                      </div>
                      
                      {/* Remove button */}
                      <button
                        type="button"
                        onClick={() => onRemove(link)}
                        className="text-gray-400 hover:text-red-500 transition-colors p-1"
                        title="Remove link"
                      >
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                        </svg>
                      </button>
                    </div>
                  )}
                </Draggable>
              );
            })}
            {provided.placeholder}
          </div>
        )}
      </Droppable>
    </DragDropContext>
  );
};

// ============================================
// ADD LINK INLINE FORM
// ============================================
// Allows user to add a link to a note
// - User picks a category (required)
// - For TEAMS: Shows autocomplete search to ensure valid team names
// - For LEAGUES: Shows autocomplete search to ensure valid league names
// - For OTHER types: Free text input (optional)
// NOTE: This is NOT a <form> because it's rendered inside the parent modal's form.
//       Using a nested form causes the parent form to submit unexpectedly.
const AddLinkInline = ({ onAdd, onCancel, existingTypes }) => {
  const [selectedType, setSelectedType] = useState('betting');
  const [labelValue, setLabelValue] = useState('');
  
  // For team autocomplete - stores both ID and name
  const [selectedTeam, setSelectedTeam] = useState(null);
  
  // For league autocomplete - stores both ID and name
  const [selectedLeague, setSelectedLeague] = useState(null);

  const handleAdd = () => {
    // For teams, use the selected team from autocomplete
    if (selectedType === 'team') {
      if (!selectedTeam) {
        return; // Can't add team without selecting from autocomplete
      }
      onAdd({
        contextType: 'team',
        contextId: selectedTeam.contextId,  // SportsMonks ID (e.g., "19")
        label: selectedTeam.label           // Team name (e.g., "Arsenal")
      });
      setSelectedTeam(null);
      return;
    }
    
    // For leagues, use the selected league from autocomplete
    if (selectedType === 'league') {
      if (!selectedLeague) {
        return; // Can't add league without selecting from autocomplete
      }
      onAdd({
        contextType: 'league',
        contextId: selectedLeague.contextId,  // SportsMonks ID (e.g., "8")
        label: selectedLeague.label           // League name (e.g., "Premier League")
      });
      setSelectedLeague(null);
      return;
    }
    
    // For other types, use the free text input
    const userValue = labelValue.trim();
    onAdd({
      contextType: selectedType,
      contextId: userValue,   // Can be empty - that's OK!
      label: userValue || null
    });
    setLabelValue('');
  };

  // Handle team selection from autocomplete - AUTO-ADD immediately
  const handleTeamSelect = (team) => {
    // Check if this team already exists as a link
    const alreadyExists = existingTypes.some(
      existing => existing.contextType === 'team' && 
                  existing.contextId === team.contextId
    );
    
    if (alreadyExists) {
      // Don't add duplicate - just show the team as selected
      setSelectedTeam(team);
      return;
    }
    
    // Immediately add the link (no need to click "Add" button)
    onAdd({
      contextType: 'team',
      contextId: team.contextId,  // SportsMonks ID (e.g., "19")
      label: team.label           // Team name (e.g., "Arsenal")
    });
  };
  
  // Handle league selection from autocomplete - AUTO-ADD immediately
  const handleLeagueSelect = (league) => {
    // Check if this league already exists as a link
    const alreadyExists = existingTypes.some(
      existing => existing.contextType === 'league' && 
                  existing.contextId === league.contextId
    );
    
    if (alreadyExists) {
      // Don't add duplicate - just show the league as selected
      setSelectedLeague(league);
      return;
    }
    
    // Immediately add the link (no need to click "Add" button)
    onAdd({
      contextType: 'league',
      contextId: league.contextId,  // SportsMonks ID (e.g., "8")
      label: league.label           // League name (e.g., "Premier League")
    });
  };

  // Check if this exact type+id combo already exists
  const isDuplicate = () => {
    if (selectedType === 'team' && selectedTeam) {
      return existingTypes.some(
        existing => existing.contextType === 'team' && 
                    existing.contextId === selectedTeam.contextId
      );
    }
    if (selectedType === 'league' && selectedLeague) {
      return existingTypes.some(
        existing => existing.contextType === 'league' && 
                    existing.contextId === selectedLeague.contextId
      );
    }
    return existingTypes.some(
      existing => existing.contextType === selectedType && 
                  existing.contextId === labelValue.trim()
    );
  };

  // Get placeholder text based on selected type
  const getPlaceholder = () => {
    switch (selectedType) {
      case 'fixture': return 'Optional: match description...';
      case 'player': return 'Optional: player name...';
      case 'betting': return 'Optional: strategy name...';
      default: return 'Optional: specify...';
    }
  };

  // Handle Enter key in input field (for non-autocomplete types)
  const handleKeyDown = (e) => {
    if (e.key === 'Enter') {
      e.preventDefault();  // Prevent parent form submission
      if (!isDuplicate()) {
        handleAdd();
      }
    }
  };

  // Reset selections when switching types
  const handleTypeChange = (newType) => {
    setSelectedType(newType);
    setSelectedTeam(null);
    setSelectedLeague(null);
    setLabelValue('');
  };

  // Determine if Add button should be disabled
  const isAddDisabled = () => {
    if (isDuplicate()) return true;
    if (selectedType === 'team' && !selectedTeam) return true;
    if (selectedType === 'league' && !selectedLeague) return true;
    return false;
  };
  
  // Get button title/tooltip
  const getButtonTitle = () => {
    if (isDuplicate()) return 'This link already exists';
    if (selectedType === 'team' && !selectedTeam) return 'Select a team first';
    if (selectedType === 'league' && !selectedLeague) return 'Select a league first';
    return 'Add link';
  };

  return (
    <div className="flex items-center gap-2 mt-2">
      {/* Category dropdown (required) */}
      <select
        value={selectedType}
        onChange={(e) => handleTypeChange(e.target.value)}
        className="px-2 py-1 text-xs border border-gray-600 rounded focus:outline-none focus:ring-1 focus:ring-amber-500"
      >
        {CONTEXT_TYPES.filter(t => t.value !== 'all').map(type => (
          <option key={type.value} value={type.value}>
            {type.icon} {type.label}
          </option>
        ))}
      </select>
      
      {/* TEAM: Show autocomplete search */}
      {selectedType === 'team' && (
        <TeamSearchInput
          onSelect={handleTeamSelect}
          placeholder="Search for a team..."
        />
      )}
      
      {/* LEAGUE: Show autocomplete search */}
      {selectedType === 'league' && (
        <LeagueSearchInput
          onSelect={handleLeagueSelect}
          placeholder="Search for a league..."
        />
      )}
      
      {/* OTHER TYPES (except general, team, league): Show free text input */}
      {selectedType !== 'team' && selectedType !== 'league' && selectedType !== 'general' && (
        <input
          type="text"
          value={labelValue}
          onChange={(e) => setLabelValue(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder={getPlaceholder()}
          className="flex-1 px-2 py-1 text-xs border border-gray-600 rounded focus:outline-none focus:ring-1 focus:ring-amber-500"
          autoFocus
        />
      )}
      
      {/* Show duplicate warning for teams (only shows if duplicate selected) */}
      {selectedType === 'team' && selectedTeam && (
        <span className="text-xs text-amber-600 font-medium">
          ⚠ {selectedTeam.label} already added
        </span>
      )}
      
      {/* Show duplicate warning for leagues (only shows if duplicate selected) */}
      {selectedType === 'league' && selectedLeague && (
        <span className="text-xs text-amber-600 font-medium">
          ⚠ {selectedLeague.label} already added
        </span>
      )}
      
      <button
        type="button"
        onClick={handleAdd}
        disabled={isAddDisabled()}
        className="px-2 py-1 text-xs bg-amber-500 text-gray-900 rounded hover:bg-amber-600 disabled:opacity-50 disabled:cursor-not-allowed"
        title={getButtonTitle()}
      >
        Add
      </button>
      <button
        type="button"
        onClick={onCancel}
        className="px-2 py-1 text-xs text-gray-400 hover:text-gray-300"
      >
        Cancel
      </button>
    </div>
  );
};

// ============================================
// EDIT NOTE MODAL
// ============================================
const EditNoteModal = ({ note, onSave, onCancel, saving }) => {
  const [title, setTitle] = useState(note.title || '');
  const [content, setContent] = useState(note.content || '');
  
  // Sort links so primary is first, then add tempIds
  const [links, setLinks] = useState(() => {
    const sortedLinks = [...(note.links || [])].sort((a, b) => {
      if (a.isPrimary) return -1;
      if (b.isPrimary) return 1;
      return 0;
    });
    return sortedLinks.map((l, idx) => ({
      ...l,
      tempId: l.id || idx
    }));
  });
  
  const [showAddLink, setShowAddLink] = useState(false);
  const [error, setError] = useState('');

  // Handle adding a new link (goes to end of list)
  const handleAddLink = (newLink) => {
    if (links.length >= MAX_LINKS) {
      setError(`Maximum ${MAX_LINKS} links allowed`);
      return;
    }
    
    const linkWithId = {
      ...newLink,
      tempId: Date.now()
    };
    
    setLinks([...links, linkWithId]);
    setShowAddLink(false);
    setError('');
  };

  // Handle removing a link
  const handleRemoveLink = (linkToRemove) => {
    if (links.length <= 1) {
      setError('At least one link is required');
      return;
    }
    
    const newLinks = links.filter(l => 
      (l.tempId || l.id) !== (linkToRemove.tempId || linkToRemove.id)
    );
    setLinks(newLinks);
    setError('');
  };

  // Handle reordering links (from drag-drop or star click)
  const handleReorderLinks = (reorderedLinks) => {
    setLinks(reorderedLinks);
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    
    if (!title.trim() || !content.trim()) {
      setError('Title and content are required');
      return;
    }
    
    if (links.length === 0) {
      setError('At least one link is required');
      return;
    }
    
    // Build links for API - first link is always primary
    const apiLinks = links.map((link, index) => ({
      contextType: link.contextType,
      contextId: link.contextId || '',
      label: link.label || null,
      isPrimary: index === 0  // First link is primary
    }));
    
    onSave({
      title: title.trim(),
      content: content.trim(),
      links: apiLinks
    });
  };

  // Pass full link info for duplicate checking (type + id combo)
  const existingLinks = links.map(l => ({
    contextType: l.contextType,
    contextId: l.contextId || ''
  }));

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50">
      <div className="bg-gray-800 rounded-lg shadow-xl w-full max-w-2xl max-h-[90vh] overflow-hidden">
        {/* Header */}
        <div className="px-6 py-4 border-b border-gray-700 flex items-center justify-between">
          <h2 className="text-xl font-semibold text-gray-100">Edit Note</h2>
          <button
            onClick={onCancel}
            className="text-gray-400 hover:text-gray-400 text-2xl leading-none"
          >
            ×
          </button>
        </div>
        
        {/* Body */}
        <form onSubmit={handleSubmit} className="p-6 space-y-4 overflow-y-auto" style={{ maxHeight: 'calc(90vh - 140px)' }}>
          {error && (
            <div className="bg-red-900/30 text-red-400 p-3 rounded-md text-sm">
              {error}
            </div>
          )}
          
          {/* Title */}
          <div>
            <label className="block text-sm font-medium text-gray-300 mb-1">
              Title
            </label>
            <input
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              className="w-full px-3 py-2 border border-gray-600 rounded-md focus:outline-none focus:ring-2 focus:ring-amber-500"
              placeholder="Note title"
              required
            />
          </div>
          
          {/* Content */}
          <div>
            <label className="block text-sm font-medium text-gray-300 mb-1">
              Content
            </label>
            <textarea
              value={content}
              onChange={(e) => setContent(e.target.value)}
              rows={6}
              className="w-full px-3 py-2 border border-gray-600 rounded-md focus:outline-none focus:ring-2 focus:ring-amber-500"
              placeholder="Your notes..."
              required
            />
          </div>
          
          {/* Links */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <label className="block text-sm font-medium text-gray-300">
                Links ({links.length}/{MAX_LINKS})
              </label>
              {links.length < MAX_LINKS && !showAddLink && (
                <button
                  type="button"
                  onClick={() => setShowAddLink(true)}
                  className="text-sm text-amber-500 hover:text-amber-400"
                >
                  + Add Link
                </button>
              )}
            </div>
            
            {/* Draggable link list */}
            <DraggableLinkList
              links={links}
              onReorder={handleReorderLinks}
              onRemove={handleRemoveLink}
              onMakePrimary={handleReorderLinks}
            />
            
            {showAddLink && (
              <AddLinkInline
                onAdd={handleAddLink}
                onCancel={() => setShowAddLink(false)}
                existingTypes={existingLinks}
              />
            )}
            
            <p className="mt-2 text-xs text-gray-400">
              ★ First link is primary • Drag to reorder or click ☆ to make primary
            </p>
          </div>
        </form>
        
        {/* Footer */}
        <div className="px-6 py-4 border-t border-gray-700 flex justify-end space-x-3">
          <button
            type="button"
            onClick={onCancel}
            className="px-4 py-2 text-gray-400 hover:text-gray-200"
            disabled={saving}
          >
            Cancel
          </button>
          <button
            onClick={handleSubmit}
            disabled={saving}
            className="px-4 py-2 bg-amber-500 text-gray-900 rounded-md hover:bg-amber-600 disabled:opacity-50"
          >
            {saving ? 'Saving...' : 'Save Changes'}
          </button>
        </div>
      </div>
    </div>
  );
};

// ============================================
// CREATE NOTE MODAL
// ============================================
const CreateNoteModal = ({ onSave, onCancel, saving }) => {
  const [title, setTitle] = useState('');
  const [content, setContent] = useState('');
  const [links, setLinks] = useState([
    { tempId: 1, contextType: 'general', contextId: '' }
  ]);
  const [showAddLink, setShowAddLink] = useState(false);
  const [error, setError] = useState('');

  // Handle adding a new link (goes to end of list)
  const handleAddLink = (newLink) => {
    if (links.length >= MAX_LINKS) {
      setError(`Maximum ${MAX_LINKS} links allowed`);
      return;
    }
    
    const linkWithId = {
      ...newLink,
      tempId: Date.now()
    };
    
    setLinks([...links, linkWithId]);
    setShowAddLink(false);
    setError('');
  };

  // Handle removing a link
  const handleRemoveLink = (linkToRemove) => {
    if (links.length <= 1) {
      setError('At least one link is required');
      return;
    }
    
    const newLinks = links.filter(l => l.tempId !== linkToRemove.tempId);
    setLinks(newLinks);
    setError('');
  };

  // Handle reordering links (from drag-drop or star click)
  const handleReorderLinks = (reorderedLinks) => {
    setLinks(reorderedLinks);
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    
    if (!title.trim() || !content.trim()) {
      setError('Title and content are required');
      return;
    }
    
    if (links.length === 0) {
      setError('At least one link is required');
      return;
    }
    
    // Build links for API - first link is always primary
    const apiLinks = links.map((link, index) => ({
      contextType: link.contextType,
      contextId: link.contextId || '',
      label: link.label || null,
      isPrimary: index === 0  // First link is primary
    }));
    
    onSave({
      title: title.trim(),
      content: content.trim(),
      links: apiLinks
    });
  };

  // Pass full link info for duplicate checking (type + id combo)
  const existingLinks = links.map(l => ({
    contextType: l.contextType,
    contextId: l.contextId || ''
  }));

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50">
      <div className="bg-gray-800 rounded-lg shadow-xl w-full max-w-2xl max-h-[90vh] overflow-hidden">
        {/* Header */}
        <div className="px-6 py-4 border-b border-gray-700 flex items-center justify-between bg-amber-500">
          <h2 className="text-xl font-semibold text-white">Create New Note</h2>
          <button
            onClick={onCancel}
            className="text-white/80 hover:text-white text-2xl leading-none"
          >
            ×
          </button>
        </div>
        
        {/* Body */}
        <form onSubmit={handleSubmit} className="p-6 space-y-4 overflow-y-auto" style={{ maxHeight: 'calc(90vh - 140px)' }}>
          {error && (
            <div className="bg-red-900/30 text-red-400 p-3 rounded-md text-sm">
              {error}
            </div>
          )}
          
          {/* Title */}
          <div>
            <label className="block text-sm font-medium text-gray-300 mb-1">
              Title
            </label>
            <input
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              className="w-full px-3 py-2 border border-gray-600 rounded-md focus:outline-none focus:ring-2 focus:ring-amber-500"
              placeholder="Note title"
              required
              autoFocus
            />
          </div>
          
          {/* Content */}
          <div>
            <label className="block text-sm font-medium text-gray-300 mb-1">
              Content
            </label>
            <textarea
              value={content}
              onChange={(e) => setContent(e.target.value)}
              rows={6}
              className="w-full px-3 py-2 border border-gray-600 rounded-md focus:outline-none focus:ring-2 focus:ring-amber-500"
              placeholder="Your betting research notes..."
              required
            />
          </div>
          
          {/* Links */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <label className="block text-sm font-medium text-gray-300">
                Links ({links.length}/{MAX_LINKS})
              </label>
              {links.length < MAX_LINKS && !showAddLink && (
                <button
                  type="button"
                  onClick={() => setShowAddLink(true)}
                  className="text-sm text-amber-500 hover:text-amber-400"
                >
                  + Add Link
                </button>
              )}
            </div>
            
            {/* Draggable link list */}
            <DraggableLinkList
              links={links}
              onReorder={handleReorderLinks}
              onRemove={handleRemoveLink}
              onMakePrimary={handleReorderLinks}
            />
            
            {showAddLink && (
              <AddLinkInline
                onAdd={handleAddLink}
                onCancel={() => setShowAddLink(false)}
                existingTypes={existingLinks}
              />
            )}
            
            <p className="mt-2 text-xs text-gray-400">
              ★ First link is primary • Drag to reorder or click ☆ to make primary
            </p>
          </div>
        </form>
        
        {/* Footer */}
        <div className="px-6 py-4 border-t border-gray-700 flex justify-end space-x-3">
          <button
            type="button"
            onClick={onCancel}
            className="px-4 py-2 text-gray-400 hover:text-gray-200"
            disabled={saving}
          >
            Cancel
          </button>
          <button
            onClick={handleSubmit}
            disabled={saving}
            className="px-4 py-2 bg-amber-500 text-gray-900 rounded-md hover:bg-amber-600 disabled:opacity-50"
          >
            {saving ? 'Creating...' : 'Create Note'}
          </button>
        </div>
      </div>
    </div>
  );
};

// ============================================
// NOTE CARD COMPONENT
// ============================================
const NoteCard = ({ note, onEdit, onDelete }) => {
  const primaryLink = note.links?.find(l => l.isPrimary) || note.links?.[0];
  const otherLinks = note.links?.filter(l => l !== primaryLink) || [];
  
  return (
    <div className="bg-gray-800 rounded-lg shadow-md p-4 hover:shadow-lg transition-shadow">
      <div className="flex items-start justify-between gap-4">
        {/* Note content */}
        <div className="flex-1 min-w-0">
          {/* Title */}
          <Link
            to={`/notes/${note.id}`}
            className="text-lg font-semibold text-gray-100 hover:text-amber-500 line-clamp-1"
          >
            {note.title}
          </Link>
          
          {/* Date */}
          <p className="text-xs text-gray-400 mt-0.5">
            {formatDate(note.updatedAt || note.createdAt)}
          </p>
          
          {/* Content preview */}
          {note.content && (
            <p className="text-gray-400 mt-2 text-sm line-clamp-2">
              {note.content}
            </p>
          )}
          
          {/* Links */}
          {note.links && note.links.length > 0 && (
            <div className="flex flex-wrap gap-1 mt-3">
              {/* Primary link first */}
              {primaryLink && (
                <LinkTag link={primaryLink} isPrimary={true} />
              )}
              {/* Other links */}
              {otherLinks.map((link) => (
                <LinkTag key={link.id} link={link} isPrimary={false} />
              ))}
            </div>
          )}
        </div>
        
        {/* Actions */}
        <div className="flex flex-col space-y-1 flex-shrink-0">
          <button
            onClick={() => onEdit(note)}
            className="px-3 py-1 text-sm text-amber-500 hover:text-amber-400 hover:bg-gray-700 rounded transition-colors"
          >
            Edit
          </button>
          <button
            onClick={() => onDelete(note)}
            className="px-3 py-1 text-sm text-red-500 hover:text-red-700 hover:bg-red-900/30 rounded transition-colors"
          >
            Delete
          </button>
        </div>
      </div>
    </div>
  );
};

// ============================================
// MAIN NOTES PAGE COMPONENT
// ============================================
const Notes = () => {
  const { token } = useAuth();
  
  // Data state
  const [notes, setNotes] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  
  // Search and filter state
  const [searchQuery, setSearchQuery] = useState('');
  const [filterType, setFilterType] = useState('all');
  
  // Modal state
  const [showCreate, setShowCreate] = useState(false);
  const [editingNote, setEditingNote] = useState(null);
  const [saving, setSaving] = useState(false);

  // ============================================
  // FETCH NOTES
  // ============================================
  useEffect(() => {
    fetchNotes();
  }, [token]);

  const fetchNotes = async () => {
    setLoading(true);
    setError('');

    try {
      const data = await notesApi.getAll(token);
      setNotes(data.notes || []);
    } catch (err) {
      setError(err.message || 'Failed to load notes');
    } finally {
      setLoading(false);
    }
  };

  // ============================================
  // FILTERED NOTES (with search and type filter)
  // ============================================
  const filteredNotes = useMemo(() => {
    let result = notes;
    
    // Filter by type
    if (filterType !== 'all') {
      result = result.filter(note => 
        note.links?.some(link => link.contextType === filterType)
      );
    }
    
    // Filter by search query
    if (searchQuery.trim()) {
      const query = searchQuery.toLowerCase();
      result = result.filter(note => {
        // Search in title
        if (note.title?.toLowerCase().includes(query)) return true;
        // Search in content
        if (note.content?.toLowerCase().includes(query)) return true;
        // Search in link labels (contextId)
        if (note.links?.some(link => 
          link.contextId?.toLowerCase().includes(query) ||
          link.contextType?.toLowerCase().includes(query)
        )) return true;
        return false;
      });
    }
    
    // Sort by primary link first when filtering by type
    // Notes where the filtered type is PRIMARY come first,
    // then notes where it's a secondary link.
    // Within each group, maintain chronological order (newest first).
    if (filterType !== 'all') {
      result = [...result].sort((a, b) => {
        // Check if note A has this type as primary
        const aIsPrimary = a.links?.some(
          link => link.contextType === filterType && link.isPrimary
        );
        // Check if note B has this type as primary
        const bIsPrimary = b.links?.some(
          link => link.contextType === filterType && link.isPrimary
        );
        
        // Primary links come first
        if (aIsPrimary && !bIsPrimary) return -1;  // A before B
        if (!aIsPrimary && bIsPrimary) return 1;   // B before A
        
        // Within same group, sort by date (newest first)
        return new Date(b.updatedAt) - new Date(a.updatedAt);
      });
    }
    
    return result;
  }, [notes, filterType, searchQuery]);

  // ============================================
  // LINK TYPE COUNTS (for filter badges)
  // ============================================
  const linkTypeCounts = useMemo(() => {
    const counts = { all: notes.length };
    
    CONTEXT_TYPES.forEach(type => {
      if (type.value !== 'all') {
        counts[type.value] = notes.filter(note =>
          note.links?.some(link => link.contextType === type.value)
        ).length;
      }
    });
    
    return counts;
  }, [notes]);

  // ============================================
  // HANDLERS
  // ============================================
  const handleCreate = async (noteData) => {
    setSaving(true);
    setError('');

    try {
      await notesApi.create(noteData, token);
      setShowCreate(false);
      fetchNotes();
    } catch (err) {
      setError(err.message || 'Failed to create note');
    } finally {
      setSaving(false);
    }
  };

  const handleEdit = async (noteData) => {
    if (!editingNote) return;
    
    setSaving(true);
    setError('');

    try {
      await notesApi.update(editingNote.id, noteData, token);
      setEditingNote(null);
      fetchNotes();
    } catch (err) {
      setError(err.message || 'Failed to update note');
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (note) => {
    if (!confirm(`Delete "${note.title}"? This cannot be undone.`)) return;

    try {
      await notesApi.delete(note.id, token);
      setNotes(notes.filter(n => n.id !== note.id));
    } catch (err) {
      setError(err.message || 'Failed to delete note');
    }
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
          <h1 className="text-2xl font-bold text-gray-100">My Notes</h1>
          <p className="text-sm text-gray-400 mt-1">
            {notes.length} {notes.length === 1 ? 'note' : 'notes'} total
          </p>
        </div>
        <button
          onClick={() => setShowCreate(true)}
          className="bg-amber-500 text-gray-900 px-4 py-2 rounded-md hover:bg-amber-600 flex items-center space-x-2"
        >
          <span>+</span>
          <span>New Note</span>
        </button>
      </div>

      {/* ============================================ */}
      {/* SEARCH AND FILTERS */}
      {/* ============================================ */}
      <div className="bg-gray-800 rounded-lg shadow-md p-4 space-y-4">
        {/* Search bar */}
        <div className="relative">
          <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400">
            🔍
          </span>
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search notes by title, content, or links..."
            className="w-full pl-10 pr-4 py-2 border border-gray-600 rounded-md focus:outline-none focus:ring-2 focus:ring-amber-500"
          />
          {searchQuery && (
            <button
              onClick={() => setSearchQuery('')}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-400"
            >
              ×
            </button>
          )}
        </div>
        
        {/* Type filter buttons */}
        <div className="flex flex-wrap gap-2">
          {CONTEXT_TYPES.map(type => (
            <button
              key={type.value}
              onClick={() => setFilterType(type.value)}
              className={`px-3 py-1.5 rounded-full text-sm font-medium transition-colors
                ${filterType === type.value
                  ? 'bg-amber-500 text-gray-900'
                  : 'bg-gray-700 text-gray-400 hover:bg-gray-600'
                }`}
            >
              {type.icon} {type.label}
              {linkTypeCounts[type.value] > 0 && (
                <span className={`ml-1.5 px-1.5 py-0.5 rounded-full text-xs
                  ${filterType === type.value
                    ? 'bg-amber-500 text-gray-900'
                    : 'bg-gray-600 text-gray-400'
                  }`}
                >
                  {linkTypeCounts[type.value]}
                </span>
              )}
            </button>
          ))}
        </div>
      </div>

      {/* ============================================ */}
      {/* ERROR MESSAGE */}
      {/* ============================================ */}
      {error && (
        <div className="bg-red-900/30 text-red-400 p-3 rounded-md">
          {error}
        </div>
      )}

      {/* ============================================ */}
      {/* NOTES LIST */}
      {/* ============================================ */}
      {loading ? (
        <div className="text-center py-12 text-gray-400">
          Loading notes...
        </div>
      ) : filteredNotes.length === 0 ? (
        <div className="text-center py-12 bg-gray-800 rounded-lg shadow-md">
          {searchQuery || filterType !== 'all' ? (
            <>
              <p className="text-gray-400 text-lg">No notes found</p>
              <p className="text-gray-400 text-sm mt-1">
                Try adjusting your search or filters
              </p>
              <button
                onClick={() => {
                  setSearchQuery('');
                  setFilterType('all');
                }}
                className="mt-4 text-amber-500 hover:text-amber-400"
              >
                Clear filters
              </button>
            </>
          ) : (
            <>
              <p className="text-gray-400 text-lg">No notes yet</p>
              <p className="text-gray-400 text-sm mt-1">
                Create your first note to get started!
              </p>
              <button
                onClick={() => setShowCreate(true)}
                className="mt-4 bg-amber-500 text-gray-900 px-4 py-2 rounded-md hover:bg-amber-600"
              >
                Create Note
              </button>
            </>
          )}
        </div>
      ) : (
        <div className="space-y-4">
          {/* Results count */}
          {(searchQuery || filterType !== 'all') && (
            <p className="text-sm text-gray-400">
              Showing {filteredNotes.length} of {notes.length} notes
            </p>
          )}
          
          {/* Note cards */}
          {filteredNotes.map((note) => (
            <NoteCard
              key={note.id}
              note={note}
              onEdit={setEditingNote}
              onDelete={handleDelete}
            />
          ))}
        </div>
      )}

      {/* ============================================ */}
      {/* CREATE MODAL */}
      {/* ============================================ */}
      {showCreate && (
        <CreateNoteModal
          onSave={handleCreate}
          onCancel={() => setShowCreate(false)}
          saving={saving}
        />
      )}

      {/* ============================================ */}
      {/* EDIT MODAL */}
      {/* ============================================ */}
      {editingNote && (
        <EditNoteModal
          note={editingNote}
          onSave={handleEdit}
          onCancel={() => setEditingNote(null)}
          saving={saving}
        />
      )}
    </div>
  );
};

export default Notes;
