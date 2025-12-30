// ============================================
// NOTES ROUTES
// ============================================
// CRUD operations for user notes.
// All routes are protected by authMiddleware (applied in index.js).
// Users can only access their own notes.
// ============================================

import express from 'express';
import prisma from '../db.js';

// Create a router (a mini Express app for just these routes)
const router = express.Router();

// ============================================
// CREATE NOTE
// POST /notes
// Body: { title, content, links: [{ contextType, contextId?, label?, isPrimary }] }
// ============================================

router.post('/', async (req, res) => {
  try {
    // 1. Get the userId from the token (set by authMiddleware)
    const userId = req.user.userId;

    // 2. Get note data from request body
    const { title, content, links } = req.body;

    // 3. Validate required fields
    if (!title || !content) {
      return res.status(400).json({
        error: 'Missing required fields: title and content are required'
      });
    }

    // 4. Validate links array
    if (!links || !Array.isArray(links) || links.length === 0) {
      return res.status(400).json({
        error: 'At least one link is required in the links array'
      });
    }

    // 5. Validate each link in the array
    // Supported context types:
    //   - team: Link to a specific team (e.g., "Arsenal")
    //   - fixture: Link to a specific match (e.g., "Arsenal vs Chelsea")
    //   - player: Link to a specific player (e.g., "Haaland")
    //   - league: Link to a competition (e.g., "Premier League")
    //   - betting: Link to a betting strategy/category (e.g., "BTTS Research")
    //   - general: No specific link, just a general note
    const validContextTypes = ['team', 'fixture', 'player', 'league', 'betting', 'general'];

    for (const link of links) {
      // Check contextType is valid
      if (!link.contextType || !validContextTypes.includes(link.contextType)) {
        return res.status(400).json({
          error: `Invalid contextType in link. Must be one of: ${validContextTypes.join(', ')}`
        });
      }
      // Note: contextId is now OPTIONAL for all types
      // Users can just tag with a category (e.g., "Teams") without specifying which team
    }

    // 6. Validate exactly one link is marked as primary
    const primaryLinks = links.filter(link => link.isPrimary === true);

    if (primaryLinks.length === 0) {
      return res.status(400).json({
        error: 'Exactly one link must have isPrimary: true'
      });
    }

    if (primaryLinks.length > 1) {
      return res.status(400).json({
        error: 'Only one link can have isPrimary: true'
      });
    }

    // 7. Create the note with nested links (atomic transaction)
    const note = await prisma.note.create({
      data: {
        title,
        content,
        userId,
        links: {
          create: links.map(link => ({
            contextType: link.contextType,
            contextId: link.contextId || '',  // Empty string if not provided
            label: link.label || null,        // Store friendly name (e.g., "Arsenal")
            isPrimary: link.isPrimary || false
          }))
        }
      },
      include: {
        links: true
      }
    });

    // 8. Return the created note with links
    res.status(201).json({
      message: 'Note created successfully',
      note: note
    });

  } catch (error) {
    console.error('Error creating note:', error);
    res.status(500).json({ error: 'Server error' });
  }
});

// ============================================
// GET ALL NOTES
// GET /notes
// Optional query params: ?contextType=team&contextId=123
// Filters notes where ANY link matches the criteria
// ============================================

router.get('/', async (req, res) => {
  try {
    // 1. Get the userId from the token
    const userId = req.user.userId;

    // 2. Get optional filter parameters from query string
    const { contextType, contextId } = req.query;

    // 3. Build the query filter
    //    Always filter by userId (users can only see their own notes)
    const whereClause = { userId };

    // 4. If filtering by context, find notes where ANY link matches
    if (contextType || contextId) {
      whereClause.links = {
        some: {}
      };

      if (contextType) {
        whereClause.links.some.contextType = contextType;
      }

      if (contextId) {
        whereClause.links.some.contextId = contextId;
      }
    }

    // 5. Fetch notes from database with their links
    const notes = await prisma.note.findMany({
      where: whereClause,
      include: {
        links: true
      },
      orderBy: { updatedAt: 'desc' }  // Most recently updated first
    });

    // 6. Return the notes
    res.json({
      count: notes.length,
      notes: notes
    });

  } catch (error) {
    console.error('Error fetching notes:', error);
    res.status(500).json({ error: 'Server error' });
  }
});

// ============================================
// GET SINGLE NOTE
// GET /notes/:id
// ============================================

router.get('/:id', async (req, res) => {
  try {
    // 1. Get the userId from the token
    const userId = req.user.userId;

    // 2. Get the note ID from the URL parameter
    const noteId = req.params.id;

    // 3. Fetch the note from database with its links
    const note = await prisma.note.findUnique({
      where: { id: noteId },
      include: {
        links: true
      }
    });

    // 4. Check if note exists
    if (!note) {
      return res.status(404).json({ error: 'Note not found' });
    }

    // 5. Check if this note belongs to the logged-in user
    //    This is a security check - users can only view their own notes
    if (note.userId !== userId) {
      return res.status(403).json({ error: 'Access denied. This note belongs to another user.' });
    }

    // 6. Return the note with links
    res.json({ note: note });

  } catch (error) {
    console.error('Error fetching note:', error);
    res.status(500).json({ error: 'Server error' });
  }
});

// ============================================
// UPDATE NOTE
// PUT /notes/:id
// Body: { title?, content?, links? }
// If links provided, replaces all existing links
// ============================================

router.put('/:id', async (req, res) => {
  try {
    // 1. Get the userId from the token
    const userId = req.user.userId;

    // 2. Get the note ID from the URL parameter
    const noteId = req.params.id;

    // 3. Get the fields to update from request body
    const { title, content, links } = req.body;

    // 4. Check that at least one field is provided
    if (!title && !content && !links) {
      return res.status(400).json({
        error: 'Nothing to update. Provide at least title, content, or links.'
      });
    }

    // 5. First, find the note to check ownership
    const existingNote = await prisma.note.findUnique({
      where: { id: noteId }
    });

    // 6. Check if note exists
    if (!existingNote) {
      return res.status(404).json({ error: 'Note not found' });
    }

    // 7. Check if this note belongs to the logged-in user
    if (existingNote.userId !== userId) {
      return res.status(403).json({
        error: 'Access denied. You can only edit your own notes.'
      });
    }

    // 8. If links are provided, validate them
    if (links) {
      if (!Array.isArray(links) || links.length === 0) {
        return res.status(400).json({
          error: 'At least one link is required in the links array'
        });
      }

      // Supported context types (must match CREATE route)
      const validContextTypes = ['team', 'fixture', 'player', 'league', 'betting', 'general'];

      for (const link of links) {
        if (!link.contextType || !validContextTypes.includes(link.contextType)) {
          return res.status(400).json({
            error: `Invalid contextType in link. Must be one of: ${validContextTypes.join(', ')}`
          });
        }
        // Note: contextId is now OPTIONAL for all types
        // Users can just tag with a category (e.g., "Teams") without specifying which team
      }

      const primaryLinks = links.filter(link => link.isPrimary === true);

      if (primaryLinks.length === 0) {
        return res.status(400).json({
          error: 'Exactly one link must have isPrimary: true'
        });
      }

      if (primaryLinks.length > 1) {
        return res.status(400).json({
          error: 'Only one link can have isPrimary: true'
        });
      }
    }

    // 9. Build the update object
    const updateData = {};
    if (title) updateData.title = title;
    if (content) updateData.content = content;

    // 10. If links provided, delete existing and create new (replace strategy)
    if (links) {
      updateData.links = {
        deleteMany: {},  // Delete all existing links
        create: links.map(link => ({
          contextType: link.contextType,
          contextId: link.contextId || '',  // Empty string if not provided
          label: link.label || null,        // Store friendly name (e.g., "Arsenal")
          isPrimary: link.isPrimary || false
        }))
      };
    }

    // 11. Update the note
    const updatedNote = await prisma.note.update({
      where: { id: noteId },
      data: updateData,
      include: {
        links: true
      }
    });

    // 12. Return the updated note with links
    res.json({
      message: 'Note updated successfully',
      note: updatedNote
    });

  } catch (error) {
    console.error('Error updating note:', error);
    res.status(500).json({ error: 'Server error' });
  }
});

// ============================================
// DELETE NOTE
// DELETE /notes/:id
// ============================================

router.delete('/:id', async (req, res) => {
  try {
    // 1. Get the userId from the token
    const userId = req.user.userId;

    // 2. Get the note ID from the URL parameter
    const noteId = req.params.id;

    // 3. First, find the note to check ownership
    const existingNote = await prisma.note.findUnique({
      where: { id: noteId }
    });

    // 4. Check if note exists
    if (!existingNote) {
      return res.status(404).json({ error: 'Note not found' });
    }

    // 5. Check if this note belongs to the logged-in user
    if (existingNote.userId !== userId) {
      return res.status(403).json({ 
        error: 'Access denied. You can only delete your own notes.' 
      });
    }

    // 6. Delete the note
    await prisma.note.delete({
      where: { id: noteId }
    });

    // 7. Return success message
    res.json({
      message: 'Note deleted successfully',
      deletedNoteId: noteId
    });

  } catch (error) {
    console.error('Error deleting note:', error);
    res.status(500).json({ error: 'Server error' });
  }
});

// ============================================
// EXPORT THE ROUTER
// ============================================

export default router;
