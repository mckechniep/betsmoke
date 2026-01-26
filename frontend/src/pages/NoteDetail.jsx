// ============================================
// NOTE DETAIL PAGE
// ============================================

import { useState, useEffect } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { notesApi } from '../api/client';

const NoteDetail = () => {
  const { id } = useParams();
  const { token } = useAuth();
  const navigate = useNavigate();

  const [note, setNote] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  // Edit mode
  const [editing, setEditing] = useState(false);
  const [title, setTitle] = useState('');
  const [content, setContent] = useState('');
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    const fetchNote = async () => {
      setLoading(true);
      setError('');

      try {
        const data = await notesApi.getById(id, token);
        setNote(data.note);
        setTitle(data.note.title);
        setContent(data.note.content || '');
      } catch (err) {
        setError(err.message || 'Failed to load note');
      } finally {
        setLoading(false);
      }
    };

    fetchNote();
  }, [id, token]);

  const handleSave = async (e) => {
    e.preventDefault();
    setSaving(true);
    setError('');

    try {
      const data = await notesApi.update(
        id,
        {
          title,
          content,
          links: note.links?.map(l => ({
            contextType: l.contextType,
            contextId: l.contextId,
            isPrimary: l.isPrimary
          })) || [{ contextType: 'general', contextId: 'general', isPrimary: true }]
        },
        token
      );
      setNote(data.note);
      setEditing(false);
    } catch (err) {
      setError(err.message || 'Failed to save note');
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async () => {
    if (!confirm('Delete this note?')) return;

    try {
      await notesApi.delete(id, token);
      navigate('/notes');
    } catch (err) {
      setError(err.message || 'Failed to delete note');
    }
  };

  const formatDate = (dateString) => {
    return new Date(dateString).toLocaleString(undefined, {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  if (loading) {
    return (
      <div className="text-center py-12 text-gray-400">Loading note...</div>
    );
  }

  if (error && !note) {
    return (
      <div className="space-y-4">
        <div className="bg-red-900/30 text-red-400 p-3 rounded-md">{error}</div>
        <Link to="/notes" className="text-amber-500 hover:underline">
          &larr; Back to Notes
        </Link>
      </div>
    );
  }

  if (!note) {
    return (
      <div className="text-center py-12 text-gray-400">Note not found.</div>
    );
  }

  return (
    <div className="space-y-6">
      <Link to="/notes" className="text-amber-500 hover:underline">
        &larr; Back to Notes
      </Link>

      {error && (
        <div className="bg-red-900/30 text-red-400 p-3 rounded-md">{error}</div>
      )}

      <div className="bg-gray-800 rounded-lg shadow-md p-6">
        {editing ? (
          <form onSubmit={handleSave} className="space-y-4">
            <div>
              <label htmlFor="title" className="block text-sm font-medium text-gray-300 mb-1">
                Title
              </label>
              <input
                type="text"
                id="title"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                required
                className="w-full px-3 py-2 border border-gray-600 rounded-md focus:outline-none focus:ring-2 focus:ring-amber-500"
              />
            </div>

            <div>
              <label htmlFor="content" className="block text-sm font-medium text-gray-300 mb-1">
                Content
              </label>
              <textarea
                id="content"
                value={content}
                onChange={(e) => setContent(e.target.value)}
                rows={8}
                className="w-full px-3 py-2 border border-gray-600 rounded-md focus:outline-none focus:ring-2 focus:ring-amber-500"
              />
            </div>

            <div className="flex gap-2">
              <button
                type="submit"
                disabled={saving}
                className="bg-green-600 text-white px-4 py-2 rounded-md hover:bg-green-700 disabled:opacity-50"
              >
                {saving ? 'Saving...' : 'Save'}
              </button>
              <button
                type="button"
                onClick={() => {
                  setTitle(note.title);
                  setContent(note.content || '');
                  setEditing(false);
                }}
                className="bg-gray-600 text-gray-200 px-4 py-2 rounded-md hover:bg-gray-500"
              >
                Cancel
              </button>
            </div>
          </form>
        ) : (
          <>
            <div className="flex items-start justify-between mb-4">
              <div>
                <h1 className="text-2xl font-bold text-gray-100">{note.title}</h1>
                <p className="text-sm text-gray-400 mt-1">
                  Created: {formatDate(note.createdAt)}
                  {note.updatedAt !== note.createdAt && (
                    <> | Updated: {formatDate(note.updatedAt)}</>
                  )}
                </p>
              </div>
              <div className="flex gap-2">
                <button
                  onClick={() => setEditing(true)}
                  className="text-amber-500 hover:text-amber-400"
                >
                  Edit
                </button>
                <button
                  onClick={handleDelete}
                  className="text-red-500 hover:text-red-700"
                >
                  Delete
                </button>
              </div>
            </div>

            {note.links && note.links.length > 0 && (
              <div className="flex gap-2 mb-4">
                {note.links.map((link) => (
                  <span
                    key={link.id}
                    className={`text-xs px-2 py-1 rounded ${
                      link.isPrimary
                        ? 'bg-amber-900/30 text-amber-400'
                        : 'bg-gray-700 text-gray-400'
                    }`}
                  >
                    {link.contextType}: {link.contextId}
                    {link.isPrimary && ' (primary)'}
                  </span>
                ))}
              </div>
            )}

            <div className="prose prose-gray max-w-none">
              {note.content ? (
                <p className="whitespace-pre-wrap">{note.content}</p>
              ) : (
                <p className="text-gray-400 italic">No content</p>
              )}
            </div>
          </>
        )}
      </div>
    </div>
  );
};

export default NoteDetail;
