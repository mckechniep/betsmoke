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
import { useAuth } from '../context/AuthContext';
import { notesApi } from '../api/client';

// ============================================
// CONSTANTS
// ============================================
const MAX_LINKS = 6;

const CONTEXT_TYPES = [
  { value: 'all', label: 'All Types', icon: '📋' },
  { value: 'fixture', label: 'Matches', icon: '⚽' },
  { value: 'team', label: 'Teams', icon: '🛡️' },
  { value: 'player', label: 'Players', icon: '👤' },
  { value: 'league', label: 'Leagues', icon: '🏆' },
  { value: 'betting', label: 'Betting', icon: '🎰' },
  { value: 'general', label: 'General', icon: '📝' },
];

// ============================================
// HELPER: Get icon for context type
// ============================================
const getContextIcon = (contextType) => {
  const found = CONTEXT_TYPES.find(t => t.value === contextType);
  return found?.icon || '📎';
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
// LINK TAG COMPONENT (for display and editing)
// ============================================
const LinkTag = ({ link, isPrimary, onRemove, onSetPrimary, editable = false }) => {
  const displayLabel = link.contextId || link.contextType;
  
  return (
    <span 
      className={`inline-flex items-center rounded-full text-xs font-medium
        ${isPrimary 
          ? 'bg-blue-100 text-blue-800' 
          : 'bg-gray-100 text-gray-600'
        }`}
    >
      {editable && onSetPrimary && (
        <button
          type="button"
          onClick={() => onSetPrimary(link)}
          className={`px-1.5 py-0.5 rounded-l-full transition-colors
            ${isPrimary ? 'text-blue-600' : 'text-gray-400 hover:text-yellow-500'}`}
          title={isPrimary ? 'Primary link' : 'Set as primary'}
        >
          {isPrimary ? '★' : '☆'}
        </button>
      )}
      
      <span className={`py-0.5 ${editable ? '' : 'px-2'}`}>
        {getContextIcon(link.contextType)} {displayLabel}
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
// ADD LINK INLINE FORM
// ============================================
const AddLinkInline = ({ onAdd, onCancel, existingTypes }) => {
  const [selectedType, setSelectedType] = useState('betting');
  const [labelValue, setLabelValue] = useState('');

  const handleSubmit = (e) => {
    e.preventDefault();
    if (!labelValue.trim() && selectedType !== 'general') return;
    
    onAdd({
      contextType: selectedType,
      contextId: selectedType === 'general' ? '' : labelValue.trim(),
    });
    
    setLabelValue('');
  };

  const isGeneralUsed = existingTypes.includes('general');

  return (
    <form onSubmit={handleSubmit} className="flex items-center gap-2 mt-2">
      <select
        value={selectedType}
        onChange={(e) => setSelectedType(e.target.value)}
        className="px-2 py-1 text-xs border border-gray-300 rounded focus:outline-none focus:ring-1 focus:ring-blue-500"
      >
        {CONTEXT_TYPES.filter(t => t.value !== 'all').map(type => (
          <option 
            key={type.value} 
            value={type.value}
            disabled={type.value === 'general' && isGeneralUsed}
          >
            {type.icon} {type.label}
          </option>
        ))}
      </select>
      
      {selectedType !== 'general' && (
        <input
          type="text"
          value={labelValue}
          onChange={(e) => setLabelValue(e.target.value)}
          placeholder="Label..."
          className="flex-1 px-2 py-1 text-xs border border-gray-300 rounded focus:outline-none focus:ring-1 focus:ring-blue-500"
          autoFocus
        />
      )}
      
      <button
        type="submit"
        disabled={selectedType !== 'general' && !labelValue.trim()}
        className="px-2 py-1 text-xs bg-blue-600 text-white rounded hover:bg-blue-700 disabled:opacity-50"
      >
        Add
      </button>
      <button
        type="button"
        onClick={onCancel}
        className="px-2 py-1 text-xs text-gray-500 hover:text-gray-700"
      >
        Cancel
      </button>
    </form>
  );
};

// ============================================
// EDIT NOTE MODAL
// ============================================
const EditNoteModal = ({ note, onSave, onCancel, saving }) => {
  const [title, setTitle] = useState(note.title || '');
  const [content, setContent] = useState(note.content || '');
  const [links, setLinks] = useState(
    (note.links || []).map((l, idx) => ({
      ...l,
      tempId: l.id || idx  // Use existing ID or index as temp ID
    }))
  );
  const [primaryLinkId, setPrimaryLinkId] = useState(
    note.links?.find(l => l.isPrimary)?.id || note.links?.[0]?.id || null
  );
  const [showAddLink, setShowAddLink] = useState(false);
  const [error, setError] = useState('');

  const handleAddLink = (newLink) => {
    if (links.length >= MAX_LINKS) {
      setError(`Maximum ${MAX_LINKS} links allowed`);
      return;
    }
    
    const linkWithId = {
      ...newLink,
      tempId: Date.now()
    };
    
    const newLinks = [...links, linkWithId];
    setLinks(newLinks);
    setShowAddLink(false);
    setError('');
    
    if (links.length === 0) {
      setPrimaryLinkId(linkWithId.tempId);
    }
  };

  const handleRemoveLink = (linkToRemove) => {
    if (links.length <= 1) {
      setError('At least one link is required');
      return;
    }
    
    const newLinks = links.filter(l => (l.tempId || l.id) !== (linkToRemove.tempId || linkToRemove.id));
    setLinks(newLinks);
    
    const removedId = linkToRemove.tempId || linkToRemove.id;
    if (removedId === primaryLinkId && newLinks.length > 0) {
      setPrimaryLinkId(newLinks[0].tempId || newLinks[0].id);
    }
    setError('');
  };

  const handleSetPrimary = (link) => {
    setPrimaryLinkId(link.tempId || link.id);
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
    
    // Build links for API
    const apiLinks = links.map(link => ({
      contextType: link.contextType,
      contextId: link.contextType === 'general' ? '' : (link.contextId || ''),
      isPrimary: (link.tempId || link.id) === primaryLinkId
    }));
    
    onSave({
      title: title.trim(),
      content: content.trim(),
      links: apiLinks
    });
  };

  const existingTypes = links.map(l => l.contextType);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50">
      <div className="bg-white rounded-lg shadow-xl w-full max-w-2xl max-h-[90vh] overflow-hidden">
        {/* Header */}
        <div className="px-6 py-4 border-b border-gray-200 flex items-center justify-between">
          <h2 className="text-xl font-semibold text-gray-900">Edit Note</h2>
          <button
            onClick={onCancel}
            className="text-gray-400 hover:text-gray-600 text-2xl leading-none"
          >
            ×
          </button>
        </div>
        
        {/* Body */}
        <form onSubmit={handleSubmit} className="p-6 space-y-4 overflow-y-auto" style={{ maxHeight: 'calc(90vh - 140px)' }}>
          {error && (
            <div className="bg-red-50 text-red-600 p-3 rounded-md text-sm">
              {error}
            </div>
          )}
          
          {/* Title */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Title
            </label>
            <input
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
              placeholder="Note title"
              required
            />
          </div>
          
          {/* Content */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Content
            </label>
            <textarea
              value={content}
              onChange={(e) => setContent(e.target.value)}
              rows={6}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
              placeholder="Your notes..."
              required
            />
          </div>
          
          {/* Links */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <label className="block text-sm font-medium text-gray-700">
                Links ({links.length}/{MAX_LINKS})
              </label>
              {links.length < MAX_LINKS && !showAddLink && (
                <button
                  type="button"
                  onClick={() => setShowAddLink(true)}
                  className="text-sm text-blue-600 hover:text-blue-800"
                >
                  + Add Link
                </button>
              )}
            </div>
            
            <div className="flex flex-wrap gap-1 p-3 bg-gray-50 rounded-md min-h-[40px]">
              {links.map(link => (
                <LinkTag
                  key={link.tempId || link.id}
                  link={link}
                  isPrimary={(link.tempId || link.id) === primaryLinkId}
                  onRemove={handleRemoveLink}
                  onSetPrimary={handleSetPrimary}
                  editable={true}
                />
              ))}
              {links.length === 0 && (
                <span className="text-sm text-gray-400">No links - add at least one</span>
              )}
            </div>
            
            {showAddLink && (
              <AddLinkInline
                onAdd={handleAddLink}
                onCancel={() => setShowAddLink(false)}
                existingTypes={existingTypes}
              />
            )}
            
            <p className="mt-1 text-xs text-gray-500">
              ★ = primary link (shown first in searches)
            </p>
          </div>
        </form>
        
        {/* Footer */}
        <div className="px-6 py-4 border-t border-gray-200 flex justify-end space-x-3">
          <button
            type="button"
            onClick={onCancel}
            className="px-4 py-2 text-gray-600 hover:text-gray-800"
            disabled={saving}
          >
            Cancel
          </button>
          <button
            onClick={handleSubmit}
            disabled={saving}
            className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 disabled:opacity-50"
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
  const [primaryLinkId, setPrimaryLinkId] = useState(1);
  const [showAddLink, setShowAddLink] = useState(false);
  const [error, setError] = useState('');

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

  const handleRemoveLink = (linkToRemove) => {
    if (links.length <= 1) {
      setError('At least one link is required');
      return;
    }
    
    const newLinks = links.filter(l => l.tempId !== linkToRemove.tempId);
    setLinks(newLinks);
    
    if (linkToRemove.tempId === primaryLinkId && newLinks.length > 0) {
      setPrimaryLinkId(newLinks[0].tempId);
    }
    setError('');
  };

  const handleSetPrimary = (link) => {
    setPrimaryLinkId(link.tempId);
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
    
    const apiLinks = links.map(link => ({
      contextType: link.contextType,
      contextId: link.contextType === 'general' ? '' : (link.contextId || ''),
      isPrimary: link.tempId === primaryLinkId
    }));
    
    onSave({
      title: title.trim(),
      content: content.trim(),
      links: apiLinks
    });
  };

  const existingTypes = links.map(l => l.contextType);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50">
      <div className="bg-white rounded-lg shadow-xl w-full max-w-2xl max-h-[90vh] overflow-hidden">
        {/* Header */}
        <div className="px-6 py-4 border-b border-gray-200 flex items-center justify-between bg-blue-600">
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
            <div className="bg-red-50 text-red-600 p-3 rounded-md text-sm">
              {error}
            </div>
          )}
          
          {/* Title */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Title
            </label>
            <input
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
              placeholder="Note title"
              required
              autoFocus
            />
          </div>
          
          {/* Content */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Content
            </label>
            <textarea
              value={content}
              onChange={(e) => setContent(e.target.value)}
              rows={6}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
              placeholder="Your betting research notes..."
              required
            />
          </div>
          
          {/* Links */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <label className="block text-sm font-medium text-gray-700">
                Links ({links.length}/{MAX_LINKS})
              </label>
              {links.length < MAX_LINKS && !showAddLink && (
                <button
                  type="button"
                  onClick={() => setShowAddLink(true)}
                  className="text-sm text-blue-600 hover:text-blue-800"
                >
                  + Add Link
                </button>
              )}
            </div>
            
            <div className="flex flex-wrap gap-1 p-3 bg-gray-50 rounded-md min-h-[40px]">
              {links.map(link => (
                <LinkTag
                  key={link.tempId}
                  link={link}
                  isPrimary={link.tempId === primaryLinkId}
                  onRemove={handleRemoveLink}
                  onSetPrimary={handleSetPrimary}
                  editable={true}
                />
              ))}
            </div>
            
            {showAddLink && (
              <AddLinkInline
                onAdd={handleAddLink}
                onCancel={() => setShowAddLink(false)}
                existingTypes={existingTypes}
              />
            )}
            
            <p className="mt-1 text-xs text-gray-500">
              ★ = primary link • Click to change
            </p>
          </div>
        </form>
        
        {/* Footer */}
        <div className="px-6 py-4 border-t border-gray-200 flex justify-end space-x-3">
          <button
            type="button"
            onClick={onCancel}
            className="px-4 py-2 text-gray-600 hover:text-gray-800"
            disabled={saving}
          >
            Cancel
          </button>
          <button
            onClick={handleSubmit}
            disabled={saving}
            className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 disabled:opacity-50"
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
    <div className="bg-white rounded-lg shadow-md p-4 hover:shadow-lg transition-shadow">
      <div className="flex items-start justify-between gap-4">
        {/* Note content */}
        <div className="flex-1 min-w-0">
          {/* Title */}
          <Link
            to={`/notes/${note.id}`}
            className="text-lg font-semibold text-gray-900 hover:text-blue-600 line-clamp-1"
          >
            {note.title}
          </Link>
          
          {/* Date */}
          <p className="text-xs text-gray-500 mt-0.5">
            {formatDate(note.updatedAt || note.createdAt)}
          </p>
          
          {/* Content preview */}
          {note.content && (
            <p className="text-gray-600 mt-2 text-sm line-clamp-2">
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
            className="px-3 py-1 text-sm text-blue-600 hover:text-blue-800 hover:bg-blue-50 rounded transition-colors"
          >
            Edit
          </button>
          <button
            onClick={() => onDelete(note)}
            className="px-3 py-1 text-sm text-red-500 hover:text-red-700 hover:bg-red-50 rounded transition-colors"
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
          <h1 className="text-2xl font-bold text-gray-900">My Notes</h1>
          <p className="text-sm text-gray-500 mt-1">
            {notes.length} {notes.length === 1 ? 'note' : 'notes'} total
          </p>
        </div>
        <button
          onClick={() => setShowCreate(true)}
          className="bg-blue-600 text-white px-4 py-2 rounded-md hover:bg-blue-700 flex items-center space-x-2"
        >
          <span>+</span>
          <span>New Note</span>
        </button>
      </div>

      {/* ============================================ */}
      {/* SEARCH AND FILTERS */}
      {/* ============================================ */}
      <div className="bg-white rounded-lg shadow-md p-4 space-y-4">
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
            className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
          {searchQuery && (
            <button
              onClick={() => setSearchQuery('')}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
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
                  ? 'bg-blue-600 text-white'
                  : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                }`}
            >
              {type.icon} {type.label}
              {linkTypeCounts[type.value] > 0 && (
                <span className={`ml-1.5 px-1.5 py-0.5 rounded-full text-xs
                  ${filterType === type.value
                    ? 'bg-blue-500 text-white'
                    : 'bg-gray-200 text-gray-600'
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
        <div className="bg-red-50 text-red-600 p-3 rounded-md">
          {error}
        </div>
      )}

      {/* ============================================ */}
      {/* NOTES LIST */}
      {/* ============================================ */}
      {loading ? (
        <div className="text-center py-12 text-gray-500">
          Loading notes...
        </div>
      ) : filteredNotes.length === 0 ? (
        <div className="text-center py-12 bg-white rounded-lg shadow-md">
          {searchQuery || filterType !== 'all' ? (
            <>
              <p className="text-gray-500 text-lg">No notes found</p>
              <p className="text-gray-400 text-sm mt-1">
                Try adjusting your search or filters
              </p>
              <button
                onClick={() => {
                  setSearchQuery('');
                  setFilterType('all');
                }}
                className="mt-4 text-blue-600 hover:text-blue-800"
              >
                Clear filters
              </button>
            </>
          ) : (
            <>
              <p className="text-gray-500 text-lg">No notes yet</p>
              <p className="text-gray-400 text-sm mt-1">
                Create your first note to get started!
              </p>
              <button
                onClick={() => setShowCreate(true)}
                className="mt-4 bg-blue-600 text-white px-4 py-2 rounded-md hover:bg-blue-700"
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
            <p className="text-sm text-gray-500">
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
