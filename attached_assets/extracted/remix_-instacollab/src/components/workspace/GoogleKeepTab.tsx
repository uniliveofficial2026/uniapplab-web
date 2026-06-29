import React, { useState, useEffect } from 'react';
import { useDB } from '../../lib/useDB';
import { 
  Plus, MoreVertical, Trash2, CheckSquare, Square, 
  Search, Palette, Grid, List, Pin, Star, Archive, ShieldCheck
} from 'lucide-react';

interface KeepItem {
  id: string;
  title: string;
  content: string;
  color: string;
  pinned: boolean;
  archived: boolean;
  isChecklist: boolean;
  checklistItems: Array<{ id: string; text: string; done: boolean }>;
  tags: string[];
  updatedAt: number;
}

const KEEP_COLORS = [
  { name: 'default', bg: 'bg-card border-border', colorHex: '#ffffff' },
  { name: 'red', bg: 'bg-red-500/10 border-red-500/30 text-red-900 dark:text-red-200', colorHex: '#f28b82' },
  { name: 'orange', bg: 'bg-orange-500/10 border-orange-500/30 text-orange-900 dark:text-orange-200', colorHex: '#fbbc04' },
  { name: 'yellow', bg: 'bg-yellow-500/10 border-yellow-500/30 text-yellow-900 dark:text-yellow-200', colorHex: '#fff475' },
  { name: 'green', bg: 'bg-emerald-500/10 border-emerald-500/30 text-emerald-900 dark:text-emerald-200', colorHex: '#ccff90' },
  { name: 'teal', bg: 'bg-teal-500/10 border-teal-500/30 text-teal-900 dark:text-teal-200', colorHex: '#a7ffeb' },
  { name: 'blue', bg: 'bg-blue-500/10 border-blue-500/30 text-blue-900 dark:text-blue-200', colorHex: '#cbf0f8' },
  { name: 'purple', bg: 'bg-purple-500/10 border-purple-500/30 text-purple-900 dark:text-purple-200', colorHex: '#d7aefb' },
  { name: 'pink', bg: 'bg-pink-500/10 border-pink-500/30 text-pink-900 dark:text-pink-200', colorHex: '#fdcfe8' },
];

export function GoogleKeepTab() {
  const db = useDB();
  const [notes, setNotes] = useState<KeepItem[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  
  // New Note Creator State
  const [isCreating, setIsCreating] = useState(false);
  const [newTitle, setNewTitle] = useState('');
  const [newContent, setNewContent] = useState('');
  const [newColor, setNewColor] = useState('default');
  const [newIsChecklist, setNewIsChecklist] = useState(false);
  const [newChecklistInput, setNewChecklistInput] = useState('');
  const [newChecklistItems, setNewChecklistItems] = useState<Array<{ id: string; text: string; done: boolean }>>([]);
  const [newTags, setNewTags] = useState<string[]>([]);
  const [newTagInput, setNewTagInput] = useState('');

  // Read notes from Database on mount
  useEffect(() => {
    let savedNotes: KeepItem[] = [];
    try {
      const savedStr = localStorage.getItem('google_keep_notes');
      if (savedStr) {
        savedNotes = JSON.parse(savedStr);
      }
    } catch (e) {
      console.error('Error loading notes from localStorage', e);
    }

    if (savedNotes && savedNotes.length > 0) {
      setNotes(savedNotes);
    } else {
      // Seed initial sample keep notes beautifully
      const seed: KeepItem[] = [
        {
          id: '1',
          title: 'Project unilive-ryz8n6 Milestones',
          content: 'Deploy cloud database structure, assign scopes for Google API integrations, configure Firestore.rules and build the multi-platform workspace preview.',
          color: 'teal',
          pinned: true,
          archived: false,
          isChecklist: false,
          checklistItems: [],
          tags: ['Urgent', 'Workspace'],
          updatedAt: Date.now() - 50000000
        },
        {
          id: '2',
          title: 'Design Critique Tasks',
          content: '',
          color: 'yellow',
          pinned: false,
          archived: false,
          isChecklist: true,
          checklistItems: [
            { id: 'c1', text: 'Enhance dark mode contrast ratio to 4.5:1 across widgets', done: true },
            { id: 'c2', text: 'Optimize Google Picker import feedback screen', done: false },
            { id: 'c3', text: 'Verify touch target sizes on mobile layouts', done: false }
          ],
          tags: ['Design'],
          updatedAt: Date.now() - 10000000
        }
      ];
      setNotes(seed);
      try {
        localStorage.setItem('google_keep_notes', JSON.stringify(seed));
      } catch (e) {
        console.error('Error saving seeded notes to localStorage', e);
      }
    }
  }, []);

  const saveNotesToDB = (updatedNotes: KeepItem[]) => {
    setNotes(updatedNotes);
    try {
      localStorage.setItem('google_keep_notes', JSON.stringify(updatedNotes));
    } catch (e) {
      console.error('Error saving notes to localStorage', e);
    }
  };

  // Add checklist item in Note Editor
  const handleAddCreatorChecklistItem = () => {
    if (!newChecklistInput.trim()) return;
    setNewChecklistItems(prev => [
      ...prev,
      { id: Math.random().toString(36).substring(2, 9), text: newChecklistInput.trim(), done: false }
    ]);
    setNewChecklistInput('');
  };

  // Add tag in Creator
  const handleAddCreatorTag = () => {
    if (!newTagInput.trim()) return;
    if (!newTags.includes(newTagInput.trim())) {
      setNewTags(prev => [...prev, newTagInput.trim()]);
    }
    setNewTagInput('');
  };

  // Save/Create Note
  const handleSaveNote = () => {
    if (!newTitle.trim() && !newContent.trim() && newChecklistItems.length === 0) {
      setIsCreating(false);
      resetCreator();
      return;
    }

    const newNote: KeepItem = {
      id: Math.random().toString(36).substring(2, 9),
      title: newTitle.trim() || 'Untitled Note',
      content: newIsChecklist ? '' : newContent.trim(),
      color: newColor,
      pinned: false,
      archived: false,
      isChecklist: newIsChecklist,
      checklistItems: newChecklistItems,
      tags: newTags,
      updatedAt: Date.now()
    };

    const updated = [newNote, ...notes];
    saveNotesToDB(updated);
    resetCreator();
    setIsCreating(false);
  };

  const resetCreator = () => {
    setNewTitle('');
    setNewContent('');
    setNewColor('default');
    setNewIsChecklist(false);
    setNewChecklistInput('');
    setNewChecklistItems([]);
    setNewTags([]);
    setNewTagInput('');
  };

  // Switch Keep card color
  const updateNoteColor = (id: string, colorName: string) => {
    const updated = notes.map(note => 
      note.id === id ? { ...note, color: colorName, updatedAt: Date.now() } : note
    );
    saveNotesToDB(updated);
  };

  // Pin/Unpin note
  const togglePinNote = (id: string) => {
    const updated = notes.map(note => 
      note.id === id ? { ...note, pinned: !note.pinned, updatedAt: Date.now() } : note
    );
    saveNotesToDB(updated);
  };

  // Archive/Unarchive note
  const toggleArchiveNote = (id: string) => {
    const updated = notes.map(note => 
      note.id === id ? { ...note, archived: !note.archived, updatedAt: Date.now() } : note
    );
    saveNotesToDB(updated);
  };

  // Delete note
  const deleteNote = (id: string) => {
    const updated = notes.filter(note => note.id !== id);
    saveNotesToDB(updated);
  };

  // Check off individual sub-task item in keep note checklist
  const toggleNoteChecklistItem = (noteId: string, itemId: string) => {
    const updated = notes.map(note => {
      if (note.id !== noteId) return note;
      const updatedItems = note.checklistItems.map(item => 
        item.id === itemId ? { ...item, done: !item.done } : item
      );
      return { ...note, checklistItems: updatedItems, updatedAt: Date.now() };
    });
    saveNotesToDB(updated);
  };

  // Filters notes based on Search
  const filteredNotes = notes.filter(note => {
    const matchesSearch = 
      note.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
      note.content.toLowerCase().includes(searchQuery.toLowerCase()) ||
      note.tags.some(t => t.toLowerCase().includes(searchQuery.toLowerCase()));
    return matchesSearch && !note.archived;
  });

  const pinnedNotes = filteredNotes.filter(n => n.pinned);
  const unpinnedNotes = filteredNotes.filter(n => !n.pinned);

  return (
    <div className="space-y-6">
      
      {/* Top Controller: Notes search and Creator */}
      <div className="flex flex-col md:flex-row gap-4 items-stretch md:items-center justify-between">
        <div className="relative flex-1 max-w-md">
          <Search className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-muted-foreground" />
          <input
            type="text"
            value={searchQuery}
            onChange={e => setSearchQuery(e.target.value)}
            placeholder="Search matching sticky notes or tag lists..."
            className="w-full bg-secondary/40 border border-border rounded-xl pl-10 pr-4 py-2.5 text-xs focus:outline-none focus:ring-2 focus:ring-primary/50 text-foreground"
          />
        </div>
        
        {!isCreating && (
          <button 
            onClick={() => setIsCreating(true)}
            className="bg-primary text-primary-foreground hover:bg-primary/95 px-5 py-2.5 rounded-xl text-xs font-bold shadow flex items-center justify-center gap-2"
          >
            <Plus className="w-4 h-4" /> Take a Sticky Note
          </button>
        )}
      </div>

      {/* Interactive Sticky Note Creator Pane */}
      {isCreating && (
        <div className="bg-card border-2 border-primary/20 rounded-2xl p-5 shadow-lg max-w-xl mx-auto space-y-4 animate-in fade-in duration-200">
          <div className="flex justify-between items-center">
            <input
              type="text"
              value={newTitle}
              onChange={e => setNewTitle(e.target.value)}
              placeholder="Title for note..."
              className="w-full font-bold text-sm bg-transparent border-none outline-none text-foreground placeholder:text-muted-foreground"
            />
            <button 
              onClick={() => setNewIsChecklist(!newIsChecklist)}
              className={`p-1.5 rounded-lg border transition-colors ${
                newIsChecklist ? 'bg-primary/10 border-primary/40 text-primary' : 'bg-secondary/40 border-border text-muted-foreground'
              }`}
              title="Toggle checklist layout mode"
            >
              <CheckSquare className="w-4 h-4" />
            </button>
          </div>

          {newIsChecklist ? (
            <div className="space-y-2">
              <div className="space-y-1">
                {newChecklistItems.map((item, id) => (
                  <div key={item.id} className="flex items-center gap-2.5 text-xs text-foreground">
                    <Square className="w-4 h-4 text-muted-foreground" />
                    <span>{item.text}</span>
                  </div>
                ))}
              </div>
              <div className="flex gap-2">
                <input
                  type="text"
                  value={newChecklistInput}
                  onChange={e => setNewChecklistInput(e.target.value)}
                  onKeyDown={e => e.key === 'Enter' && (e.preventDefault(), handleAddCreatorChecklistItem())}
                  placeholder="Add item..."
                  className="flex-1 bg-secondary/50 border border-border rounded-lg px-3 py-1.5 text-xs focus:outline-none focus:ring-2 focus:ring-primary/50 text-foreground"
                />
                <button 
                  type="button"
                  onClick={handleAddCreatorChecklistItem}
                  className="bg-secondary text-foreground hover:bg-secondary/80 px-3 py-1 text-xs font-semibold rounded-lg border border-border"
                >
                  Add
                </button>
              </div>
            </div>
          ) : (
            <textarea
              value={newContent}
              onChange={e => setNewContent(e.target.value)}
              placeholder="Take a note..."
              rows={3}
              className="w-full bg-transparent border-none outline-none text-xs text-foreground placeholder:text-muted-foreground leading-relaxed resize-none"
            />
          )}

          {/* Tags block in Creator */}
          <div className="flex flex-wrap gap-1.5 items-center">
            {newTags.map(tag => (
              <span key={tag} className="text-[10px] font-bold bg-secondary border border-border text-muted-foreground px-2 py-0.5 rounded-full flex items-center gap-1">
                {tag}
                <button onClick={() => setNewTags(prev => prev.filter(t => t !== tag))} className="hover:text-destructive">×</button>
              </span>
            ))}
            <div className="flex items-center gap-1">
              <input
                type="text"
                value={newTagInput}
                onChange={e => setNewTagInput(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && (e.preventDefault(), handleAddCreatorTag())}
                placeholder="Add label..."
                className="bg-secondary/45 border-none rounded-lg px-2 py-1 text-[10px] focus:outline-none focus:ring-1 focus:ring-primary/40 text-foreground w-20"
              />
            </div>
          </div>

          {/* Color palette selector in Creator */}
          <div className="flex justify-between items-center pt-2 border-t border-border/60">
            <div className="flex gap-1.5">
              {KEEP_COLORS.map(color => (
                <button
                  key={color.name}
                  onClick={() => setNewColor(color.name)}
                  className={`w-5 h-5 rounded-full border shadow-sm transition-transform ${
                    newColor === color.name ? 'scale-125 border-foreground' : 'border-border'
                  }`}
                  style={{ backgroundColor: color.colorHex }}
                  title={color.name}
                />
              ))}
            </div>
            <div className="flex gap-2">
              <button 
                onClick={() => { setIsCreating(false); resetCreator(); }}
                className="px-4 py-2 hover:bg-secondary rounded-xl text-xs font-semibold text-muted-foreground transition-all"
              >
                Cancel
              </button>
              <button 
                onClick={handleSaveNote}
                className="px-4 py-2 bg-primary text-primary-foreground hover:bg-primary/95 rounded-xl text-xs font-bold transition-all shadow-sm"
              >
                Save Note
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Grid of Sticky Keep Notes */}
      <div className="space-y-8">
        {/* Pinned Notes Grid */}
        {pinnedNotes.length > 0 && (
          <div className="space-y-3">
            <h3 className="text-xs font-bold uppercase tracking-wider text-muted-foreground flex items-center gap-1.5"><Pin className="w-3.5 h-3.5 fill-muted-foreground rotate-45" /> Pinned Notes</h3>
            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4">
              {pinnedNotes.map(note => renderNoteCard(note))}
            </div>
          </div>
        )}

        {/* Regular Unpinned Notes Grid */}
        <div className="space-y-3">
          {pinnedNotes.length > 0 && <h3 className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Other Notes</h3>}
          {unpinnedNotes.length === 0 && pinnedNotes.length === 0 ? (
            <div className="text-center py-16 border border-dashed border-border rounded-2xl text-muted-foreground bg-card">
              <Star className="w-10 h-10 text-muted-foreground/30 mx-auto mb-3" />
              <p className="font-bold text-sm">No keep notes matches your inquiry.</p>
              <p className="text-xs mt-1">Select "Take a Sticky Note" to structure a task checklist.</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4">
              {unpinnedNotes.map(note => renderNoteCard(note))}
            </div>
          )}
        </div>
      </div>

    </div>
  );

  // Helper note card renderer
  function renderNoteCard(note: KeepItem) {
    const colorTheme = KEEP_COLORS.find(c => c.name === note.color) || KEEP_COLORS[0];
    return (
      <div 
        key={note.id}
        className={`p-5 rounded-2xl border flex flex-col justify-between transition-all group hover:shadow-md hover:scale-[1.01] ${colorTheme.bg}`}
      >
        <div>
          {/* Note Title & Header Actions */}
          <div className="flex justify-between items-start gap-2 mb-3">
            <h4 className="font-bold text-sm leading-tight text-foreground truncate" title={note.title}>{note.title}</h4>
            <div className="flex gap-1 shrink-0">
              <button 
                onClick={() => togglePinNote(note.id)} 
                className={`p-1 rounded hover:bg-secondary/40 transition-colors ${note.pinned ? 'text-primary' : 'text-muted-foreground'}`}
              >
                <Pin className={`w-3.5 h-3.5 rotate-45 ${note.pinned ? 'fill-primary' : ''}`} />
              </button>
            </div>
          </div>

          {/* Note content or checklist list */}
          {note.isChecklist ? (
            <div className="space-y-1.5 mb-4">
              {note.checklistItems.map(item => (
                <div 
                  key={item.id} 
                  onClick={() => toggleNoteChecklistItem(note.id, item.id)}
                  className="flex items-center gap-2.5 cursor-pointer max-w-full"
                >
                  {item.done ? (
                    <CheckSquare className="w-4 h-4 text-primary shrink-0" />
                  ) : (
                    <Square className="w-4 h-4 text-muted-foreground shrink-0 hover:text-foreground transition-colors" />
                  )}
                  <span className={`text-[12px] truncate select-none ${
                    item.done ? 'line-through text-muted-foreground' : 'text-foreground font-medium'
                  }`} title={item.text}>
                    {item.text}
                  </span>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-xs text-muted-foreground leading-relaxed whitespace-pre-wrap mb-4 font-medium">
              {note.content}
            </p>
          )}

          {/* Render Tag Badges */}
          {note.tags.length > 0 && (
            <div className="flex flex-wrap gap-1 mb-4">
              {note.tags.map(tag => (
                <span key={tag} className="text-[9px] font-bold text-accent bg-accent/10 px-2 py-0.5 rounded-full border border-accent/20">
                  {tag}
                </span>
              ))}
            </div>
          )}
        </div>

        {/* Note footer (Card colors choose & actions) */}
        <div className="flex justify-between items-center pt-3 border-t border-border/20">
          <div className="flex gap-1 opacity-10 md:opacity-0 group-hover:opacity-100 transition-opacity">
            {KEEP_COLORS.map(col => (
              <button
                key={col.name}
                onClick={() => updateNoteColor(note.id, col.name)}
                className={`w-3.5 h-3.5 rounded-full border ${note.color === col.name ? 'border-foreground scale-110' : 'border-border/60 hover:scale-115'}`}
                style={{ backgroundColor: col.colorHex }}
                title={col.name}
              />
            ))}
          </div>
          <div className="flex gap-1 shrink-0 text-muted-foreground ml-auto">
            <button 
              onClick={() => toggleArchiveNote(note.id)}
              className="p-1 rounded hover:bg-secondary/40 hover:text-foreground transition-colors"
              title="Archive note"
            >
              <Archive className="w-3.5 h-3.5" />
            </button>
            <button 
              onClick={() => deleteNote(note.id)}
              className="p-1 rounded hover:bg-secondary/40 hover:text-destructive transition-colors"
              title="Delete sticky note"
            >
              <Trash2 className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>
      </div>
    );
  }
}
