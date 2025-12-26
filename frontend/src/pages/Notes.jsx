// ============================================
// NOTES PAGE
// ============================================

import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { notesApi } from '../api/client';

const Notes = () => {
  const { token } = useAuth();
  const [notes, setNotes] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  // Create note form
  const [showCreate, setShowCreate] = useState(false);
  const [title, setTitle] = useState('');
  const [content, setContent] = useState('');
  const [creating, setCreating] = useState(false);

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

  const handleCreate = async (e) => {
    e.preventDefault();
    setCreating(true);
    setError('');

    try {
      await notesApi.create(
        {
          title,
          content,
          links: [{ contextType: 'general', contextId: 'general', isPrimary: true }]
        },
        token
      );
      setTitle('');
      setContent('');
      setShowCreate(false);
      fetchNotes();
    } catch (err) {
      setError(err.message || 'Failed to create note');
    } finally {
      setCreating(false);
    }
  };

  const handleDelete = async (id) => {
    if (!confirm('Delete this note?')) return;

    try {
      await notesApi.delete(id, token);
      setNotes(notes.filter(n => n.id !== id));
    } catch (err) {
      setError(err.message || 'Failed to delete note');
    }
  };

  const formatDate = (dateString) => {
    return new Date(dateString).toLocaleDateString(undefined, {
      year: 'numeric',
      month: 'short',
      day: 'numeric'
    });
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-gray-900">My Notes</h1>
        <button
          onClick={() => setShowCreate(!showCreate)}
          className="bg-blue-600 text-white px-4 py-2 rounded-md hover:bg-blue-700"
        >
          {showCreate ? 'Cancel' : 'New Note'}
        </button>
      </div>

      {error && (
        <div className="bg-red-50 text-red-600 p-3 rounded-md">{error}</div>
      )}

      {/* Create Note Form */}
      {showCreate && (
        <form onSubmit={handleCreate} className="bg-white rounded-lg shadow-md p-6 space-y-4">
          <div>
            <label htmlFor="title" className="block text-sm font-medium text-gray-700 mb-1">
              Title
            </label>
            <input
              type="text"
              id="title"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              required
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
              placeholder="Note title"
            />
          </div>

          <div>
            <label htmlFor="content" className="block text-sm font-medium text-gray-700 mb-1">
              Content
            </label>
            <textarea
              id="content"
              value={content}
              onChange={(e) => setContent(e.target.value)}
              rows={4}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
              placeholder="Write your note..."
            />
          </div>

          <button
            type="submit"
            disabled={creating}
            className="bg-green-600 text-white px-4 py-2 rounded-md hover:bg-green-700 disabled:opacity-50"
          >
            {creating ? 'Creating...' : 'Create Note'}
          </button>
        </form>
      )}

      {/* Notes List */}
      {loading ? (
        <div className="text-center py-12 text-gray-500">Loading notes...</div>
      ) : notes.length === 0 ? (
        <div className="text-center py-12 text-gray-500">
          No notes yet. Create your first note!
        </div>
      ) : (
        <div className="space-y-4">
          {notes.map((note) => (
            <div
              key={note.id}
              className="bg-white rounded-lg shadow-md p-4"
            >
              <div className="flex items-start justify-between">
                <div className="flex-1">
                  <Link
                    to={`/notes/${note.id}`}
                    className="text-lg font-semibold text-gray-900 hover:text-blue-600"
                  >
                    {note.title}
                  </Link>
                  <p className="text-sm text-gray-500 mt-1">
                    {formatDate(note.createdAt)}
                  </p>
                  {note.content && (
                    <p className="text-gray-600 mt-2 line-clamp-2">
                      {note.content}
                    </p>
                  )}
                  {note.links && note.links.length > 0 && (
                    <div className="flex gap-2 mt-2">
                      {note.links.map((link) => (
                        <span
                          key={link.id}
                          className="text-xs bg-gray-100 text-gray-600 px-2 py-1 rounded"
                        >
                          {link.contextType}
                        </span>
                      ))}
                    </div>
                  )}
                </div>
                <button
                  onClick={() => handleDelete(note.id)}
                  className="text-red-500 hover:text-red-700 text-sm ml-4"
                >
                  Delete
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

export default Notes;
