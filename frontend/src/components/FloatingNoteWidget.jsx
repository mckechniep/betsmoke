// ============================================
// FLOATING NOTE WIDGET
// ============================================
// A floating, sticky note-taking widget that:
// - Stays fixed on the right side of the screen as user scrolls
// - Can be minimized to a small button in the bottom-right corner
// - Auto-links notes to the current context (fixture, team, etc.)
// - Allows users to edit/add/remove links before saving
// - Works on any page that provides context via props
//
// Usage:
//   <FloatingNoteWidget
//     token={authToken}
//     contextType="fixture"         // Primary link type
//     contextId="12345"             // Primary link ID
//     contextLabel="Arsenal vs Chelsea"  // Display label
//     additionalLinks={[            // Optional secondary links
//       { contextType: 'team', contextId: '19', label: 'Arsenal' },
//       { contextType: 'team', contextId: '42', label: 'Chelsea' }
//     ]}
//     onNoteAdded={() => {}}        // Optional callback after save
//   />
// ============================================

import { useState, useEffect } from 'react';
import { notesApi } from '../api/client';
import AppIcon from './AppIcon';

// ============================================
// CONSTANTS
// ============================================
const MAX_LINKS = 6;  // Maximum links per note (1 primary + up to 5 secondary)

// Available context types for the dropdown
const CONTEXT_TYPES = [
  { value: 'fixture', label: 'Match', iconName: 'soccer-ball' },
  { value: 'team', label: 'Team', iconName: 'team' },
  { value: 'player', label: 'Player', iconName: 'player' },
  { value: 'league', label: 'League', iconName: 'trophy' },
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
// HELPER: Format context type for display
// ============================================
const formatContextType = (contextType) => {
  const found = CONTEXT_TYPES.find(t => t.value === contextType);
  return found?.label || contextType;
};

// ============================================
// LINK TAG COMPONENT
// ============================================
// Displays a single link as a removable tag
// - Shows icon + category name (e.g., "🛡️ Teams")
// - If label or contextId exists, shows it in parentheses (e.g., "🛡️ Teams (Arsenal)")
const LinkTag = ({ link, isPrimary, onRemove, onSetPrimary, canRemove }) => {
  // Get the human-readable label for this context type
  const typeLabel = formatContextType(link.contextType);
  
  // Use label if available, otherwise fall back to contextId
  // label = friendly name (e.g., "Arsenal")
  // contextId = ID (e.g., "19")
  const specificValue = link.label || link.contextId;
  
  // Build display: "Category" or "Category (specific)"
  const displayLabel = specificValue 
    ? `${typeLabel} (${specificValue})`  // Has specific value
    : typeLabel;                          // Category only
  
  return (
    <div
      className={`inline-flex items-center rounded-full text-xs font-medium
        ${isPrimary
          ? 'bg-amber-900/30 text-amber-400 ring-2 ring-amber-500'
          : 'bg-gray-700 text-gray-300'
        }`}
    >
      {/* Make Primary button (star icon) */}
      <button
        type="button"
        onClick={() => onSetPrimary(link)}
        className={`px-2 py-1 rounded-l-full hover:bg-opacity-80 transition-colors
          ${isPrimary ? 'text-blue-600' : 'text-gray-400 hover:text-yellow-500'}`}
        title={isPrimary ? 'Primary link' : 'Set as primary'}
      >
        {isPrimary ? '★' : '☆'}
      </button>
      
      {/* Link content */}
      <span className="py-1 flex items-center gap-1">
        <AppIcon name={getContextIconName(link.contextType)} size="xs" className="text-gray-400" />
        <span>{displayLabel}</span>
      </span>
      
      {/* Remove button */}
      {canRemove && (
        <button
          type="button"
          onClick={() => onRemove(link)}
          className="px-2 py-1 rounded-r-full hover:bg-red-200 hover:text-red-600 transition-colors"
          title="Remove link"
        >
          ×
        </button>
      )}
      
      {/* If can't remove, just add padding */}
      {!canRemove && <span className="pr-2" />}
    </div>
  );
};

// ============================================
// ADD LINK FORM COMPONENT
// ============================================
// Allows user to add a link to a note
// - User picks a category (required)
// - User can OPTIONALLY add a specific ID/name (e.g., "Arsenal", "12345")
// - If no ID provided, the link is just a category tag
const AddLinkForm = ({ onAdd, onCancel, existingTypes }) => {
  const [selectedType, setSelectedType] = useState('betting');
  const [labelValue, setLabelValue] = useState('');

  const handleSubmit = (e) => {
    e.preventDefault();
    
    // Build the link object
    // contextId is optional - empty string means "category only"
    onAdd({
      contextType: selectedType,
      contextId: labelValue.trim(),  // Can be empty - that's OK!
      label: labelValue.trim() || ''  // Label matches contextId (or empty)
    });
    
    setLabelValue('');
    setSelectedType('betting');
  };

  // Check if this exact type+id combo already exists
  // (User can have multiple "team" links with different IDs)
  const isDuplicate = existingTypes.some(
    existing => existing.contextType === selectedType && 
                existing.contextId === labelValue.trim()
  );

  // Get placeholder text based on selected type
  const getPlaceholder = () => {
    switch (selectedType) {
      case 'team': return 'Optional: team name or ID...';
      case 'fixture': return 'Optional: match description...';
      case 'player': return 'Optional: player name...';
      case 'league': return 'Optional: league name...';
      case 'betting': return 'Optional: strategy name...';
      default: return 'Optional: specify...';
    }
  };

  return (
    <form onSubmit={handleSubmit} className="mt-2 p-2 bg-gray-700 rounded-lg border border-gray-600">
      <div className="flex flex-col space-y-2">
        {/* Category dropdown (required) */}
        <select
          value={selectedType}
          onChange={(e) => setSelectedType(e.target.value)}
          className="w-full px-2 py-1 text-sm border border-gray-600 rounded bg-gray-800 text-gray-100 focus:outline-none focus:ring-1 focus:ring-amber-500"
        >
          {CONTEXT_TYPES.map(type => (
            <option key={type.value} value={type.value}>
              {type.label}
            </option>
          ))}
        </select>
        
        {/* Optional ID/name input (not shown for 'general' since it's always just a category) */}
        {selectedType !== 'general' && (
          <input
            type="text"
            value={labelValue}
            onChange={(e) => setLabelValue(e.target.value)}
            placeholder={getPlaceholder()}
            className="w-full px-2 py-1 text-sm border border-gray-600 rounded bg-gray-800 text-gray-100 focus:outline-none focus:ring-1 focus:ring-amber-500"
            autoFocus
          />
        )}
        
        {/* Action buttons */}
        <div className="flex justify-end space-x-2">
          <button
            type="button"
            onClick={onCancel}
            className="px-2 py-1 text-xs text-gray-400 hover:text-gray-200"
          >
            Cancel
          </button>
          <button
            type="submit"
            disabled={isDuplicate}
            className="px-3 py-1 text-xs bg-blue-600 text-white rounded hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
            title={isDuplicate ? 'This link already exists' : 'Add link'}
          >
            Add
          </button>
        </div>
      </div>
    </form>
  );
};

// ============================================
// MAIN COMPONENT
// ============================================
const FloatingNoteWidget = ({
  token,
  contextType,           // Primary context type (e.g., 'fixture', 'team')
  contextId,             // Primary context ID (e.g., fixture ID, team ID)
  contextLabel,          // Human-readable label for the context
  additionalLinks = [],  // Array of { contextType, contextId, label } for secondary links
  onNoteAdded            // Optional callback when note is successfully created
}) => {
  // ============================================
  // STATE
  // ============================================
  
  // Widget visibility states
  const [isExpanded, setIsExpanded] = useState(false);
  const [isMinimized, setIsMinimized] = useState(true);
  
  // Form fields
  const [title, setTitle] = useState('');
  const [content, setContent] = useState('');
  
  // Links management
  const [links, setLinks] = useState([]);
  const [primaryLinkId, setPrimaryLinkId] = useState(null);
  const [showAddLink, setShowAddLink] = useState(false);
  
  // Form state
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState(false);

  // ============================================
  // INITIALIZE LINKS when context changes or widget opens
  // ============================================
  useEffect(() => {
    // Generate a default title based on context
    const defaultTitle = contextLabel 
      ? `Note: ${contextLabel}`
      : `${formatContextType(contextType)} Note`;
    
    setTitle(defaultTitle);
    setContent('');
    setError('');
    setSuccess(false);
    
    // Build initial links array
    const initialLinks = [];
    let linkIdCounter = 0;
    
    // Add primary link from props
    if (contextType && contextId) {
      const primaryLink = {
        id: linkIdCounter++,
        contextType,
        contextId: String(contextId),
        label: contextLabel || formatContextType(contextType)
      };
      initialLinks.push(primaryLink);
      setPrimaryLinkId(primaryLink.id);
    } else if (contextType === 'general') {
      const generalLink = {
        id: linkIdCounter++,
        contextType: 'general',
        contextId: '',
        label: 'General'
      };
      initialLinks.push(generalLink);
      setPrimaryLinkId(generalLink.id);
    }
    
    // Add additional links from props
    additionalLinks.forEach(link => {
      // Don't duplicate the primary link
      const isDuplicate = initialLinks.some(
        l => l.contextType === link.contextType && l.contextId === String(link.contextId)
      );
      if (!isDuplicate) {
        initialLinks.push({
          id: linkIdCounter++,
          contextType: link.contextType,
          contextId: String(link.contextId),
          label: link.label || formatContextType(link.contextType)
        });
      }
    });
    
    setLinks(initialLinks);
    
  }, [contextType, contextId, contextLabel, additionalLinks, isExpanded]);

  // ============================================
  // LINK MANAGEMENT HANDLERS
  // ============================================
  
  const handleAddLink = (newLink) => {
    if (links.length >= MAX_LINKS) {
      setError(`Maximum ${MAX_LINKS} links allowed per note`);
      return;
    }
    
    // Check for duplicates
    const isDuplicate = links.some(
      l => l.contextType === newLink.contextType && l.contextId === newLink.contextId
    );
    if (isDuplicate) {
      setError('This link already exists');
      return;
    }
    
    const linkWithId = {
      ...newLink,
      id: Date.now() // Simple unique ID
    };
    
    setLinks([...links, linkWithId]);
    setShowAddLink(false);
    setError('');
    
    // If this is the first link, make it primary
    if (links.length === 0) {
      setPrimaryLinkId(linkWithId.id);
    }
  };
  
  const handleRemoveLink = (linkToRemove) => {
    // Must keep at least one link
    if (links.length <= 1) {
      setError('At least one link is required');
      return;
    }
    
    const newLinks = links.filter(l => l.id !== linkToRemove.id);
    setLinks(newLinks);
    
    // If we removed the primary link, set a new primary
    if (linkToRemove.id === primaryLinkId && newLinks.length > 0) {
      setPrimaryLinkId(newLinks[0].id);
    }
    
    setError('');
  };
  
  const handleSetPrimary = (link) => {
    setPrimaryLinkId(link.id);
  };

  // ============================================
  // WIDGET HANDLERS
  // ============================================
  
  const handleOpen = () => {
    setIsMinimized(false);
    setIsExpanded(true);
    setError('');
    setSuccess(false);
  };

  const handleMinimize = () => {
    setIsExpanded(false);
    setIsMinimized(true);
  };

  const handleClose = () => {
    setIsExpanded(false);
    setIsMinimized(true);
    setContent('');
    setError('');
    setSuccess(false);
    setShowAddLink(false);
  };

  // ============================================
  // SAVE HANDLER
  // ============================================
  const handleSave = async () => {
    // Validate content
    if (!content.trim()) {
      setError('Please enter some content for your note');
      return;
    }
    
    // Validate we have at least one link
    if (links.length === 0) {
      setError('At least one link is required');
      return;
    }

    setSaving(true);
    setError('');
    setSuccess(false);

    try {
      // Build the links array for the API
      // Include label for display (e.g., "Arsenal" instead of just "19")
      const apiLinks = links.map(link => ({
        contextType: link.contextType,
        contextId: link.contextId || '',
        label: link.label || null,  // Friendly name for display
        isPrimary: link.id === primaryLinkId
      }));

      await notesApi.create({
        title: title.trim() || `${formatContextType(contextType)} Note`,
        content: content.trim(),
        links: apiLinks
      }, token);

      // Success!
      setSuccess(true);
      setContent('');  // Clear content for next note
      
      // Call optional callback
      if (onNoteAdded) {
        onNoteAdded();
      }

      // Auto-hide success after 2 seconds
      setTimeout(() => {
        setSuccess(false);
      }, 2000);

    } catch (err) {
      console.error('Failed to save note:', err);
      setError(err.message || 'Failed to save note. Please try again.');
    } finally {
      setSaving(false);
    }
  };

  // ============================================
  // DON'T RENDER if no auth token
  // ============================================
  if (!token) {
    return null;
  }

  // ============================================
  // MINIMIZED STATE - Small button in bottom-right corner
  // ============================================
  if (isMinimized) {
    return (
      <button
        onClick={handleOpen}
        className="fixed bottom-6 right-6 z-50
                   bg-blue-600 hover:bg-blue-700 
                   text-white font-medium
                   px-4 py-3 rounded-full
                   shadow-lg hover:shadow-xl
                   transition-all duration-200
                   flex items-center space-x-2"
        title="Add a note"
      >
        <AppIcon name="notes" size="md" className="text-white" />
        <span>Add Note</span>
      </button>
    );
  }

  // Pass full link info for duplicate checking (type + id combo)
  const existingLinks = links.map(l => ({
    contextType: l.contextType,
    contextId: l.contextId || ''
  }));

  // ============================================
  // EXPANDED STATE - Full form on the right side
  // ============================================
  return (
    <div 
      className="fixed top-24 right-6 z-50 w-96
                 bg-gray-800 rounded-lg shadow-2xl border border-gray-600
                 transition-all duration-200
                 flex flex-col"
      style={{ maxHeight: 'calc(100vh - 120px)' }}
    >
      {/* ============================================ */}
      {/* HEADER */}
      {/* ============================================ */}
      <div className="px-4 py-3 bg-blue-600 rounded-t-lg flex items-center justify-between flex-shrink-0">
        <div className="flex items-center space-x-2">
          <AppIcon name="notes" size="md" className="text-white" />
          <h3 className="font-semibold text-white">Add Note</h3>
        </div>
        <div className="flex items-center space-x-1">
          <button
            onClick={handleMinimize}
            className="text-white/80 hover:text-white p-1 rounded hover:bg-white/10"
            title="Minimize"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
            </svg>
          </button>
          <button
            onClick={handleClose}
            className="text-white/80 hover:text-white p-1 rounded hover:bg-white/10 text-xl leading-none"
            title="Close"
          >
            ×
          </button>
        </div>
      </div>

      {/* ============================================ */}
      {/* SCROLLABLE CONTENT AREA */}
      {/* ============================================ */}
      <div className="flex-1 overflow-y-auto">
        {/* ============================================ */}
        {/* LINKS SECTION - Editable */}
        {/* ============================================ */}
        <div className="px-4 py-3 bg-gray-700 border-b border-gray-600">
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs text-gray-500 font-medium">
              Linked to ({links.length}/{MAX_LINKS}):
            </span>
            {links.length < MAX_LINKS && !showAddLink && (
              <button
                onClick={() => setShowAddLink(true)}
                className="text-xs text-amber-500 hover:text-amber-400 font-medium"
              >
                + Add Link
              </button>
            )}
          </div>
          
          {/* Link tags */}
          <div className="flex flex-wrap gap-1">
            {links.map(link => (
              <LinkTag
                key={link.id}
                link={link}
                isPrimary={link.id === primaryLinkId}
                onRemove={handleRemoveLink}
                onSetPrimary={handleSetPrimary}
                canRemove={links.length > 1}
              />
            ))}
          </div>
          
          {/* Add link form */}
          {showAddLink && (
            <AddLinkForm
              onAdd={handleAddLink}
              onCancel={() => setShowAddLink(false)}
              existingTypes={existingLinks}
            />
          )}
          
          {/* Help text */}
          <div className="mt-2 text-xs text-gray-400">
            ★ = primary link • Click star to change
          </div>
        </div>

        {/* ============================================ */}
        {/* FORM BODY */}
        {/* ============================================ */}
        <div className="p-4 space-y-4">
          {/* Error message */}
          {error && (
            <div className="bg-red-900/30 text-red-400 p-2 rounded text-sm flex items-start space-x-2">
              <AppIcon name="warning" size="sm" className="text-red-400" />
              <span>{error}</span>
            </div>
          )}

          {/* Success message */}
          {success && (
            <div className="bg-green-900/30 text-green-400 p-2 rounded text-sm flex items-center space-x-2">
              <AppIcon name="checkmark" size="sm" className="text-green-400" />
              <span>Note saved successfully!</span>
            </div>
          )}

          {/* Title field */}
          <div>
            <label className="block text-sm font-medium text-gray-300 mb-1">
              Title
            </label>
            <input
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              className="w-full px-3 py-2 border border-gray-600 rounded-md bg-gray-800 text-gray-100
                         focus:outline-none focus:ring-2 focus:ring-amber-500 focus:border-amber-500
                         text-sm placeholder-gray-500"
              placeholder="Note title..."
            />
          </div>

          {/* Content field */}
          <div>
            <label className="block text-sm font-medium text-gray-300 mb-1">
              Content
            </label>
            <textarea
              value={content}
              onChange={(e) => setContent(e.target.value)}
              rows={5}
              className="w-full px-3 py-2 border border-gray-600 rounded-md bg-gray-800 text-gray-100
                         focus:outline-none focus:ring-2 focus:ring-amber-500 focus:border-amber-500
                         text-sm resize-none placeholder-gray-500"
              placeholder="Your betting research notes..."
              autoFocus
            />
          </div>
        </div>
      </div>

      {/* ============================================ */}
      {/* FOOTER - Action buttons */}
      {/* ============================================ */}
      <div className="px-4 py-3 border-t border-gray-600 flex justify-end space-x-2 flex-shrink-0">
        <button
          onClick={handleClose}
          className="px-4 py-2 text-gray-400 hover:text-gray-200 text-sm"
          disabled={saving}
        >
          Cancel
        </button>
        <button
          onClick={handleSave}
          disabled={saving || !content.trim() || links.length === 0}
          className="px-4 py-2 bg-blue-600 text-white rounded-md 
                     hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed
                     text-sm font-medium
                     flex items-center space-x-2"
        >
          {saving ? (
            <>
              <svg className="animate-spin h-4 w-4" fill="none" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
              </svg>
              <span>Saving...</span>
            </>
          ) : (
            <span>Save Note</span>
          )}
        </button>
      </div>
    </div>
  );
};

export default FloatingNoteWidget;
