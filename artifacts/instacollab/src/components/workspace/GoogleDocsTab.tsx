import React, { useState, useEffect } from 'react';
import { useAuth } from '../../lib/AuthContext';
import { useDB } from '../../lib/useDB';
import { 
  FileText, Search, Plus, Save, Trash2, X, RefreshCw, 
  CheckCircle2, ChevronRight, Edit2, History, AlertCircle, FileUp
} from 'lucide-react';

interface GoogleDocItem {
  id: string;
  name: string;
  modifiedTime: string;
  snippet?: string;
  bodyContent?: string;
}

export function GoogleDocsTab() {
  const { googleAccessToken, loginWithGoogle } = useAuth();
  const db = useDB();

  const [docs, setDocs] = useState<GoogleDocItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedDoc, setSelectedDoc] = useState<GoogleDocItem | null>(null);

  // Editor states
  const [editTitle, setEditTitle] = useState('');
  const [editContent, setEditContent] = useState('');
  const [saving, setSaving] = useState(false);
  const [statusMessage, setStatusMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  // New Doc Popover states
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [newTitle, setNewTitle] = useState('');
  const [creating, setCreating] = useState(false);

  // Rich seed docs
  const seedDocs: GoogleDocItem[] = [
    {
      id: 'doc_1',
      name: 'unilive-ryz8n6 Project Manifest',
      modifiedTime: new Date(Date.now() - 3600 * 1000 * 4).toISOString(),
      snippet: 'This document defines the high-fidelity guidelines, design typography pairings, and security boundaries.',
      bodyContent: 'unilive-ryz8n6 Project Manifest\n================================\n\nThis document outlines the core specification for the UniLive workspace application.\n\nKey Components:\n1. Firebase provisioning on us-west1 (projectId: unilive-ryz8n6).\n2. Strict Firestore rules locking permissions to authenticated profiles using zero-trust helper parameters.\n3. Complete integration with Google Workspace suite: Calendar scheduler, Gmail inbox, Contacts ledger, Google Picker, and Google Docs.'
    },
    {
      id: 'doc_2',
      name: 'Firestore Security Audit Plan',
      modifiedTime: new Date(Date.now() - 360 * 3600000).toISOString(),
      snippet: 'Zero-trust architecture. Prevent side-channel data leaks and check immutable metadata validation rules.',
      bodyContent: 'Firestore Security Audit Plan\n============================\n\nObjective: Ensure complete data locking on production collections.\n\nRules specifications:\n- Users table write locks: allow write / update only if resource UID is identical to request.auth.uid.\n- Immutable username: prevent username alterations once the setup steps complete.\n- Custom validators matching strings & formats.'
    }
  ];

  const fetchDocs = async () => {
    if (!googleAccessToken) {
      setDocs(seedDocs);
      return;
    }
    setLoading(true);
    try {
      // Fetch user Google Docs list via verified drive list query parameters
      const driveListUrl = `https://www.googleapis.com/drive/v3/files?q=mimeType='application/vnd.google-apps.document'&fields=files(id,name,modifiedTime)&pageSize=20`;
      const res = await fetch(driveListUrl, {
        headers: { Authorization: `Bearer ${googleAccessToken}` }
      });
      if (!res.ok) throw new Error('Failed to list Google Docs.');
      const data = await res.json();
      
      const mapped: GoogleDocItem[] = (data.files || []).map((f: any) => ({
        id: f.id,
        name: f.name,
        modifiedTime: f.modifiedTime || new Date().toISOString(),
        snippet: 'Google docs cloud resource'
      }));

      setDocs(mapped);
    } catch (e) {
      console.error('Error fetching Docs', e);
      setDocs([]);
    } finally {
      setLoading(false);
    }
  };

  const fetchDocBody = async (doc: GoogleDocItem) => {
    if (!googleAccessToken) {
      setEditTitle(doc.name);
      setEditContent(doc.bodyContent || '');
      setSelectedDoc(doc);
      return;
    }
    setLoading(true);
    try {
      const res = await fetch(`https://docs.googleapis.com/v1/documents/${doc.id}`, {
        headers: { Authorization: `Bearer ${googleAccessToken}` }
      });
      if (!res.ok) throw new Error('Could not pull document metadata contents.');
      const data = await res.json();
      
      // Parse plain text content from the Google Doc structure
      let fullText = '';
      if (data.body && data.body.content) {
        data.body.content.forEach((elem: any) => {
          if (elem.paragraph && elem.paragraph.elements) {
            elem.paragraph.elements.forEach((sub: any) => {
              if (sub.textRun && sub.textRun.content) {
                fullText += sub.textRun.content;
              }
            });
          }
        });
      }

      setEditTitle(data.title || doc.name);
      setEditContent(fullText || '');
      setSelectedDoc({ ...doc, name: data.title || doc.name, bodyContent: fullText });
    } catch (e: any) {
      alert(e.message || 'Error pulling document data, showing offline draft.');
      setEditTitle(doc.name);
      setEditContent(doc.bodyContent || '');
      setSelectedDoc(doc);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchDocs();
  }, [googleAccessToken]);

  const handleCreateDocument = async (e: React.FormEvent) => {
    e.preventDefault();
    const title = newTitle.trim() || 'Untitled Workspace Draft';
    setCreating(true);

    if (googleAccessToken) {
      try {
        const res = await fetch('https://docs.googleapis.com/v1/documents', {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${googleAccessToken}`,
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({ title })
        });
        if (res.ok) {
          const newDocData = await res.json();
          db.addAuditLog({ id: Date.now(), text: `Created active Google Doc: "${title}"`, time: 'Just now' });
          setIsCreateOpen(false);
          setNewTitle('');
          fetchDocs();
        } else {
          throw new Error('Google Docs server declined allocation.');
        }
      } catch (err: any) {
        alert(err.message || 'Failed to initialize active Doc.');
      } finally {
        setCreating(false);
      }
    } else {
      // Local mockup create
      const fresh: GoogleDocItem = {
        id: 'doc_' + Date.now(),
        name: title,
        modifiedTime: new Date().toISOString(),
        snippet: 'Draft created in sandbox',
        bodyContent: `${title}\n======================\n\nEnter text content here...`
      };
      setDocs(prev => [fresh, ...prev]);
      db.addAuditLog({ id: Date.now(), text: `Created local draft document: "${title}"`, time: 'Just now' });
      setIsCreateOpen(false);
      setNewTitle('');
      setCreating(false);
    }
  };

  const handleSaveDocument = async () => {
    if (!selectedDoc) return;
    
    // Explicit user confirmation for saving updates (complying with security guidelines)
    const confirmed = window.confirm(`Are you sure you want to save modifications to "${editTitle}"?`);
    if (!confirmed) return;

    setSaving(true);
    setStatusMessage(null);

    if (googleAccessToken) {
      try {
        const metaRes = await fetch(`https://docs.googleapis.com/v1/documents/${selectedDoc.id}`, {
          headers: { Authorization: `Bearer ${googleAccessToken}` },
        });
        if (!metaRes.ok) throw new Error('Could not read document before saving.');
        const meta = await metaRes.json();

        let endIndex = 1;
        const bodyContent = meta.body?.content;
        if (Array.isArray(bodyContent) && bodyContent.length > 0) {
          endIndex = bodyContent[bodyContent.length - 1]?.endIndex ?? 1;
        }

        const requests: Array<Record<string, unknown>> = [];
        if (endIndex > 2) {
          requests.push({
            deleteContentRange: {
              range: { startIndex: 1, endIndex: endIndex - 1 },
            },
          });
        }
        if (editContent) {
          requests.push({
            insertText: { location: { index: 1 }, text: editContent },
          });
        }

        if (requests.length > 0) {
          const res = await fetch(`https://docs.googleapis.com/v1/documents/${selectedDoc.id}:batchUpdate`, {
            method: 'POST',
            headers: {
              Authorization: `Bearer ${googleAccessToken}`,
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({ requests }),
          });
          if (!res.ok) throw new Error('Google batch validation service rejected payload.');
        }

        if (editTitle.trim() && editTitle !== selectedDoc.name) {
          const titleRes = await fetch(`https://www.googleapis.com/drive/v3/files/${selectedDoc.id}`, {
            method: 'PATCH',
            headers: {
              Authorization: `Bearer ${googleAccessToken}`,
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({ name: editTitle.trim() }),
          });
          if (!titleRes.ok) throw new Error('Document body saved but title update failed.');
        }

        setDocs((prev) =>
          prev.map((d) =>
            d.id === selectedDoc.id
              ? {
                  ...d,
                  name: editTitle.trim() || d.name,
                  bodyContent: editContent,
                  modifiedTime: new Date().toISOString(),
                }
              : d,
          ),
        );
        setSelectedDoc((prev) =>
          prev
            ? {
                ...prev,
                name: editTitle.trim() || prev.name,
                bodyContent: editContent,
                modifiedTime: new Date().toISOString(),
              }
            : null,
        );
        setStatusMessage({ type: 'success', text: 'Document synced successfully with Google Cloud Storage!' });
        db.addAuditLog({ id: Date.now(), text: `Updated document content for "${editTitle}"`, time: 'Just now' });
      } catch (err: any) {
        setStatusMessage({ type: 'error', text: err.message || 'Database update failure.' });
      } finally {
        setSaving(false);
      }
    } else {
      // Mock local update
      setTimeout(() => {
        setDocs(prev => prev.map(d => d.id === selectedDoc.id ? {
          ...d,
          name: editTitle,
          bodyContent: editContent,
          modifiedTime: new Date().toISOString()
        } : d));
        setSelectedDoc(prev => prev ? { ...prev, name: editTitle, bodyContent: editContent } : null);
        setStatusMessage({ type: 'success', text: 'Document changes locked successfully in mock sandbox.' });
        db.addAuditLog({ id: Date.now(), text: `Modified local draft: "${editTitle}"`, time: 'Just now' });
        setSaving(false);
      }, 700);
    }
  };

  const handleDeleteDocument = async (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    const confirmed = window.confirm('Are you sure you want to throw this document draft into trash? This action is irreversible.');
    if (!confirmed) return;

    if (googleAccessToken) {
      try {
        const res = await fetch(`https://www.googleapis.com/drive/v3/files/${id}/trash`, {
          method: 'POST',
          headers: { Authorization: `Bearer ${googleAccessToken}` }
        });
        if (res.ok) {
          setDocs(prev => prev.filter(d => d.id !== id));
          if (selectedDoc?.id === id) setSelectedDoc(null);
        } else {
          throw new Error('Deletion rejected by Drive file permissions');
        }
      } catch (err: any) {
        alert(err.message || 'Failed to delete doc.');
      }
    } else {
      setDocs(prev => prev.filter(d => d.id !== id));
      if (selectedDoc?.id === id) setSelectedDoc(null);
    }
  };

  const filteredDocs = docs.filter(doc => doc.name.toLowerCase().includes(searchQuery.toLowerCase()));

  return (
    <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 min-h-[550px]">
      
      {/* Search and Docs Listing Panel */}
      <div className={`border border-border bg-card rounded-2xl shadow-sm flex flex-col overflow-hidden ${selectedDoc ? 'lg:col-span-4 hidden lg:flex' : 'lg:col-span-12'}`}>
        
        {/* Panel Header */}
        <div className="p-4 border-b border-border bg-secondary/5 flex flex-col sm:flex-row justify-between items-stretch sm:items-center gap-3">
          <div className="flex items-center gap-2">
            <div className="p-2 bg-blue-500/10 rounded-xl text-blue-500">
              <FileText className="w-5 h-5" />
            </div>
            <div>
              <h3 className="font-bold text-foreground text-sm flex items-center gap-1.5">
                Google Docs 
                {googleAccessToken && <span className="bg-emerald-500/10 text-emerald-600 text-[10px] px-2 py-0.5 rounded-full font-bold">Live Synced</span>}
              </h3>
              <p className="text-[11px] text-muted-foreground">Manage and collaborate on office documents</p>
            </div>
          </div>
          <div className="flex gap-2">
            <button 
              onClick={() => setIsCreateOpen(true)}
              className="px-3.5 py-1.5 bg-primary hover:bg-primary/95 text-primary-foreground font-bold text-xs rounded-xl shadow-sm flex items-center gap-1.5"
            >
              <Plus className="w-3.5 h-3.5" /> Initialize Doc
            </button>
            <button 
              onClick={fetchDocs}
              disabled={loading}
              className="p-2 border border-border hover:bg-secondary/40 text-muted-foreground hover:text-foreground rounded-xl"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
            </button>
          </div>
        </div>

        {/* Searching bar */}
        <div className="p-3 border-b border-border bg-card">
          <div className="relative">
            <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
            <input 
              type="text" 
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
              placeholder="Search documents by name..."
              className="w-full bg-secondary/45 border border-border rounded-xl pl-9 p-1.5 text-xs text-foreground font-semibold focus:outline-none focus:ring-2 focus:ring-primary/55"
            />
          </div>
        </div>

        {/* Linking reminder status bar */}
        {!googleAccessToken && (
          <div className="p-3 bg-primary/5 border-b border-primary/10 text-[11px] font-semibold text-foreground flex justify-between items-center gap-3">
            <span>Link Google account to pull your active cloud templates.</span>
            <button 
              onClick={loginWithGoogle}
              className="bg-primary hover:bg-primary/95 text-primary-foreground text-[10px] py-1 px-3 rounded-lg font-bold shadow-sm"
            >
              Link Account
            </button>
          </div>
        )}

        {/* Documents Content list */}
        <div className="flex-1 overflow-y-auto divide-y divide-border/60 max-h-[480px]">
          {loading && !selectedDoc ? (
            <div className="text-center py-20 text-xs text-muted-foreground font-medium">
              <RefreshCw className="w-6 h-6 animate-spin mx-auto text-primary mb-3" />
              Loading drive resources...
            </div>
          ) : filteredDocs.length === 0 ? (
            <div className="text-center py-20 text-muted-foreground">
              <FileText className="w-8 h-8 mx-auto stroke-1 text-muted-foreground/50 mb-2" />
              <p className="text-xs font-bold">No documents matching</p>
              <p className="text-[10px] text-muted-foreground mt-0.5">Click Initialize Doc to create one.</p>
            </div>
          ) : (
            filteredDocs.map((doc) => (
              <div 
                key={doc.id}
                onClick={() => fetchDocBody(doc)}
                className={`flex justify-between items-center p-3.5 hover:bg-secondary/25 cursor-pointer transition-all border-l-2 ${selectedDoc?.id === doc.id ? 'bg-secondary/20 border-primary' : 'border-transparent'}`}
              >
                <div className="min-w-0 flex items-start gap-3">
                  <div className="p-2 bg-blue-500/10 text-blue-500 rounded-lg mt-0.5">
                    <FileText className="w-4 h-4" />
                  </div>
                  <div className="min-w-0">
                    <h4 className="text-xs text-foreground font-extrabold truncate" title={doc.name}>
                      {doc.name}
                    </h4>
                    <p className="text-[10px] text-muted-foreground font-semibold mt-1 flex items-center gap-1.5"><History className="w-3 h-3" /> Mod: {new Date(doc.modifiedTime).toLocaleDateString()}</p>
                  </div>
                </div>
                
                <div className="flex gap-1">
                  <button 
                    onClick={(e) => handleDeleteDocument(doc.id, e)}
                    className="p-1 text-muted-foreground hover:text-destructive hover:bg-secondary rounded"
                    title="Move to trash"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>
            ))
          )}
        </div>
      </div>

      {/* Interactive Editor Panel Column */}
      <div className={`lg:col-span-8 border border-border bg-card rounded-2xl shadow-sm flex flex-col overflow-hidden ${selectedDoc ? 'flex' : 'hidden lg:flex items-center justify-center p-12 bg-secondary/5'}`}>
        
        {selectedDoc ? (
          <div className="flex-grow flex flex-col h-[550px]">
            {/* Editor Header Info */}
            <div className="p-4 border-b border-border bg-secondary/5 flex justify-between items-center gap-4 bg-card">
              <div className="flex-1 min-w-0">
                <input 
                  type="text" 
                  value={editTitle}
                  onChange={e => setEditTitle(e.target.value)}
                  className="bg-transparent border-b border-transparent hover:border-border/60 focus:border-primary focus:outline-none text-sm font-black text-foreground w-full truncate pb-0.5"
                  title="Rename document"
                />
                <p className="text-[10px] text-muted-foreground font-semibold flex items-center gap-1 mt-1"><History className="w-3 h-3" /> {googleAccessToken ? 'Linked to Google • Save to sync changes' : 'Local draft • Save to persist changes'}</p>
              </div>
              <div className="flex gap-2 shrink-0">
                <button 
                  onClick={() => setSelectedDoc(null)}
                  className="px-3.5 py-1.5 border border-border hover:bg-secondary rounded-xl text-xs font-bold text-muted-foreground"
                >
                  Close Doc
                </button>
                <button 
                  onClick={handleSaveDocument}
                  disabled={saving}
                  className="px-4 py-1.5 bg-primary hover:bg-primary/95 text-primary-foreground font-bold text-xs rounded-xl shadow-md flex items-center gap-1.5"
                >
                  <Save className="w-3.5 h-3.5" /> {saving ? 'Syncing...' : 'Save Draft'}
                </button>
              </div>
            </div>

            {/* Editing Field Body text area */}
            <div className="flex-1 relative flex flex-col bg-card">
              <textarea 
                value={editContent}
                onChange={e => setEditContent(e.target.value)}
                placeholder="Start writing elegant templates here..."
                className="w-full h-full p-6 text-xs text-foreground font-semibold leading-relaxed outline-none resize-none bg-card focus:ring-0 selection:bg-blue-100"
              />
            </div>

            {/* Output status feedback notifications */}
            {statusMessage && (
              <div className="px-5 py-3 border-t border-border bg-secondary/5 flex items-center gap-2 text-[11px] font-bold">
                {statusMessage.type === 'success' ? (
                  <span className="text-emerald-600 flex items-center gap-1"><CheckCircle2 className="w-4 h-4 shrink-0" /> {statusMessage.text}</span>
                ) : (
                  <span className="text-destructive flex items-center gap-1"><AlertCircle className="w-4 h-4 shrink-0" /> {statusMessage.text}</span>
                )}
              </div>
            )}

          </div>
        ) : (
          <div className="text-center space-y-3">
            <div className="w-14 h-14 bg-primary/5 rounded-full flex items-center justify-center p-3 text-primary/70 mx-auto border border-primary/10">
              <FileText className="w-8 h-8 stroke-1" />
            </div>
            <p className="text-xs font-extrabold text-foreground">No Document Active</p>
            <p className="text-[10px] text-muted-foreground max-w-xs leading-relaxed">Select any item from the directory index list to launch the live Cloud document writer tool.</p>
          </div>
        )}

      </div>

      {/* Initialize Doc Modal Popup */}
      {isCreateOpen && (
        <div className="fixed inset-0 z-[200] bg-black/60 backdrop-blur-sm flex items-center justify-center p-4" onClick={(e) => e.target === e.currentTarget && setIsCreateOpen(false)}>
          <div className="bg-card border border-border w-full max-w-sm rounded-2xl shadow-xl overflow-hidden flex flex-col" onClick={e => e.stopPropagation()}>
            <div className="p-4 border-b border-border bg-secondary/5 flex justify-between items-center bg-card">
              <h3 className="font-extrabold text-sm text-foreground flex items-center gap-2">
                <FileText className="w-4 h-4 text-primary" /> Create Google Doc
              </h3>
              <button onClick={() => setIsCreateOpen(false)} className="p-1 rounded-lg hover:bg-secondary text-muted-foreground">
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleCreateDocument} className="p-4 space-y-4">
              <div className="space-y-1">
                <label className="text-[10px] font-bold text-muted-foreground uppercase">Document Title *</label>
                <input 
                  type="text" 
                  required
                  placeholder="e.g. Design Wireframes Specification" 
                  value={newTitle}
                  onChange={e => setNewTitle(e.target.value)}
                  className="w-full bg-secondary/30 border border-border rounded-xl p-2.5 text-xs focus:ring-2 focus:ring-primary/60 outline-none text-foreground font-bold"
                />
              </div>

              <div className="border-t border-border pt-3 flex justify-end gap-2">
                <button 
                  type="button" 
                  onClick={() => setIsCreateOpen(false)}
                  className="px-4 py-2 border border-border rounded-xl text-xs font-bold hover:bg-secondary text-muted-foreground"
                >
                  Discard
                </button>
                <button 
                  type="submit" 
                  disabled={creating}
                  className="px-4 py-2 bg-primary hover:bg-primary/95 text-primary-foreground text-xs font-bold rounded-xl shadow-md min-w-[80px]"
                >
                  {creating ? 'Allocating...' : 'Create Document'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

    </div>
  );
}
