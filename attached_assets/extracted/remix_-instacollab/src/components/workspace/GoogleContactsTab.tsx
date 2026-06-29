import React, { useState, useEffect } from 'react';
import { useAuth } from '../../lib/AuthContext';
import { 
  Users, Search, Plus, Trash2, Mail, Phone, Edit, X, 
  CheckCircle2, RefreshCw, UserPlus, Star, Info, ShieldCheck
} from 'lucide-react';

interface ContactItem {
  id: string;
  name: string;
  firstName: string;
  lastName: string;
  email: string;
  phone: string;
  photoUrl: string;
  starred: boolean;
  notes?: string;
}

export function GoogleContactsTab() {
  const { googleAccessToken, loginWithGoogle } = useAuth();
  const [contacts, setContacts] = useState<ContactItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  
  // Create / Edit modal state
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [emailInput, setEmailInput] = useState('');
  const [phoneInput, setPhoneInput] = useState('');
  const [notesInput, setNotesInput] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [statusMessage, setStatusMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  // Fallback / seed contacts
  const seedContacts: ContactItem[] = [
    {
      id: 'c_1',
      name: 'Sarah Lin',
      firstName: 'Sarah',
      lastName: 'Lin',
      email: 'sarah.lin@unilive.co',
      phone: '+1 (555) 304-9483',
      photoUrl: 'https://images.unsplash.com/photo-1494790108377-be9c29b29330?w=100&h=100&fit=crop&crop=faces',
      starred: true,
      notes: 'Lead UI Craft Architect on workspace layout.'
    },
    {
      id: 'c_2',
      name: 'Michael Chen',
      firstName: 'Michael',
      lastName: 'Chen',
      email: 'michael.c@unilive.co',
      phone: '+1 (555) 723-1129',
      photoUrl: 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=100&h=100&fit=crop&crop=faces',
      starred: true,
      notes: 'Senior Security Architect for firebase.rules database hardening.'
    },
    {
      id: 'c_3',
      name: 'David Kojo',
      firstName: 'David',
      lastName: 'Kojo',
      email: 'david.kojo@unilive.co',
      phone: '+1 (555) 894-3329',
      photoUrl: 'https://images.unsplash.com/photo-1500648767791-00dcc994a43e?w=100&h=100&fit=crop&crop=faces',
      starred: false,
      notes: 'DevOps / Cloud Run cluster deployment manager.'
    },
    {
      id: 'c_4',
      name: 'Alice Johnson',
      firstName: 'Alice',
      lastName: 'Johnson',
      email: 'alice.j@unilive.co',
      phone: '+1 (555) 124-9087',
      photoUrl: 'https://images.unsplash.com/photo-1438761681033-6461ffad8d80?w=100&h=100&fit=crop&crop=faces',
      starred: false,
      notes: 'Database developer'
    }
  ];

  const fetchContacts = async () => {
    if (!googleAccessToken) {
      setContacts(seedContacts);
      return;
    }
    setLoading(true);
    try {
      // Fetch connections via verified Google People API
      const res = await fetch('https://www.googleapis.com/people/v1/people/me/connections?personFields=names,emailAddresses,photos,phoneNumbers&pageSize=50', {
        headers: { Authorization: `Bearer ${googleAccessToken}` }
      });
      if (!res.ok) throw new Error('Failed to retrieve live Google Contacts list');
      const data = await res.json();
      
      if (!data.connections || data.connections.length === 0) {
        setContacts([]);
        setLoading(false);
        return;
      }

      const mapped: ContactItem[] = data.connections.map((c: any) => {
        const primaryName = c.names?.[0];
        const primaryEmail = c.emailAddresses?.[0]?.value || '';
        const primaryPhone = c.phoneNumbers?.[0]?.value || '';
        const photoUrl = c.photos?.[0]?.url || 'https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?w=100&h=100&fit=crop&crop=faces';
        
        return {
          id: c.resourceName || c.metadata?.source?.id || Math.random().toString(),
          name: primaryName?.displayName || `${primaryName?.givenName || ''} ${primaryName?.familyName || ''}`.trim() || 'No Name',
          firstName: primaryName?.givenName || '',
          lastName: primaryName?.familyName || '',
          email: primaryEmail,
          phone: primaryPhone,
          photoUrl: photoUrl,
          starred: c.metadata?.starred || false,
          notes: ''
        };
      });

      setContacts(mapped);
    } catch (e) {
      console.error('Error fetching Contacts', e);
      setContacts(seedContacts);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchContacts();
  }, [googleAccessToken]);

  const handleOpenAdd = () => {
    setEditingId(null);
    setFirstName('');
    setLastName('');
    setEmailInput('');
    setPhoneInput('');
    setNotesInput('');
    setIsModalOpen(true);
    setStatusMessage(null);
  };

  const handleOpenEdit = (c: ContactItem) => {
    setEditingId(c.id);
    setFirstName(c.firstName);
    setLastName(c.lastName);
    setEmailInput(c.email);
    setPhoneInput(c.phone);
    setNotesInput(c.notes || '');
    setIsModalOpen(true);
    setStatusMessage(null);
  };

  const handleCreateOrUpdate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!firstName.trim()) return;
    setSubmitting(true);
    setStatusMessage(null);

    // Explicit User Confirmation for modifying existing user data as per security guidelines
    if (editingId) {
      const ok = window.confirm('Are you sure you want to save modifications to this contact?');
      if (!ok) {
        setSubmitting(false);
        return;
      }
    }

    if (googleAccessToken) {
      try {
        let res;
        if (editingId) {
          // People API update logic (usually patch or updateContact)
          // For simple demo, we will recreate or call People update with resourceName
          // GET existing ETL person fields, then PATCH. To maintain reliability:
          const updateObj = {
            metadata: { primary: true },
            names: [{ givenName: firstName, familyName: lastName }],
            emailAddresses: [{ value: emailInput, type: 'work' }],
            phoneNumbers: [{ value: phoneInput, type: 'mobile' }]
          };
          
          res = await fetch(`https://www.googleapis.com/people/v1/${editingId}:updateContact?updatePersonFields=names,emailAddresses,phoneNumbers`, {
            method: 'PATCH',
            headers: {
              'Authorization': `Bearer ${googleAccessToken}`,
              'Content-Type': 'application/json'
            },
            body: JSON.stringify(updateObj)
          });
        } else {
          // CreateContact API call
          const createObj = {
            names: [{ givenName: firstName, familyName: lastName }],
            emailAddresses: [{ value: emailInput, type: 'work' }],
            phoneNumbers: [{ value: phoneInput, type: 'mobile' }]
          };

          res = await fetch('https://www.googleapis.com/people/v1/people:createContact', {
            method: 'POST',
            headers: {
              'Authorization': `Bearer ${googleAccessToken}`,
              'Content-Type': 'application/json'
            },
            body: JSON.stringify(createObj)
          });
        }

        if (res && res.ok) {
          setStatusMessage({ type: 'success', text: editingId ? 'Contact updated.' : 'Contact successfully added to Google Address Book.' });
          setTimeout(() => {
            setIsModalOpen(false);
            fetchContacts();
          }, 1500);
        } else {
          throw new Error('Google Contacts API rejected request body params.');
        }
      } catch (err: any) {
        setStatusMessage({ type: 'error', text: err.message || 'Action failed.' });
      } finally {
        setSubmitting(false);
      }
    } else {
      // Mock local storage changes
      setTimeout(() => {
        if (editingId) {
          setContacts(prev => prev.map(c => c.id === editingId ? {
            ...c,
            firstName,
            lastName,
            name: `${firstName} ${lastName}`.trim(),
            email: emailInput,
            phone: phoneInput,
            notes: notesInput
          } : c));
          setStatusMessage({ type: 'success', text: 'Contact updated in local mock cache.' });
        } else {
          const freshContact: ContactItem = {
            id: 'mock_c_' + Date.now(),
            name: `${firstName} ${lastName}`.trim(),
            firstName,
            lastName,
            email: emailInput,
            phone: phoneInput,
            photoUrl: 'https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?w=100&h=100&fit=crop&crop=faces',
            starred: false,
            notes: notesInput
          };
          setContacts(prev => [freshContact, ...prev]);
          setStatusMessage({ type: 'success', text: 'Contact added to local mock catalog (Link Google for live syncing).' });
        }

        setTimeout(() => {
          setIsModalOpen(false);
          setStatusMessage(null);
        }, 1800);
        setSubmitting(false);
      }, 800);
    }
  };

  const handleDeleteContact = async (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    const confirmed = window.confirm('Are you sure you want to delete this contact? This action cannot be undone.');
    if (!confirmed) return;

    if (googleAccessToken) {
      try {
        const res = await fetch(`https://www.googleapis.com/people/v1/${id}:deleteContact`, {
          method: 'DELETE',
          headers: { Authorization: `Bearer ${googleAccessToken}` }
        });
        if (res.ok) {
          setContacts(prev => prev.filter(c => c.id !== id));
        } else {
          throw new Error('Google Contacts API returned deletion failure');
        }
      } catch (err: any) {
        alert(err.message || 'Error deleting Google contact.');
      }
    } else {
      setContacts(prev => prev.filter(c => c.id !== id));
    }
  };

  const handleToggleStar = (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    setContacts(prev => prev.map(c => c.id === id ? { ...c, starred: !c.starred } : c));
  };

  const filtered = contacts.filter(c => 
    c.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    c.email.toLowerCase().includes(searchQuery.toLowerCase()) ||
    c.phone.toLowerCase().includes(searchQuery.toLowerCase())
  );

  return (
    <div className="space-y-6">
      
      {/* Search and Action header */}
      <div className="border border-border bg-card rounded-2xl p-4 sm:p-6 shadow-sm flex flex-col md:flex-row justify-between items-stretch md:items-center gap-4">
        <div className="flex items-center gap-3">
          <div className="p-2 bg-blue-500/10 rounded-xl text-blue-500">
            <Users className="w-5 h-5" />
          </div>
          <div>
            <h3 className="font-extrabold text-foreground text-sm flex items-center gap-2">
              Google Directory Contacts 
              {googleAccessToken && <span className="bg-emerald-500/10 text-emerald-600 text-[10px] px-2 py-0.5 rounded-full font-bold">Live Synced</span>}
            </h3>
            <p className="text-[11px] text-muted-foreground">Manage your connections, team profiles, and addresses securely</p>
          </div>
        </div>

        <div className="flex flex-col sm:flex-row gap-3">
          <div className="relative w-full sm:w-64">
            <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
            <input 
              type="text" 
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
              placeholder="Filter names, emails..."
              className="w-full bg-secondary/45 border border-border rounded-xl pl-9 p-2 text-xs font-semibold focus:outline-none focus:ring-2 focus:ring-primary/45 outline-none text-foreground"
            />
          </div>
          <button 
            onClick={handleOpenAdd}
            className="px-4 py-2 bg-primary hover:bg-primary/95 text-primary-foreground font-bold text-xs rounded-xl shadowflex flex-center gap-1.5 shadow-sm whitespace-nowrap self-stretch sm:self-auto flex items-center justify-center"
          >
            <UserPlus className="w-4 h-4" /> Add Connection
          </button>
        </div>
      </div>

      {/* Linking notice status bar */}
      {!googleAccessToken && (
        <div className="p-3 bg-primary/5 rounded-xl border border-primary/10 text-[11px] font-semibold text-foreground flex justify-between items-center gap-3">
          <span>Viewing internal offline contact cards. Connect to sync live Google Contacts.</span>
          <button 
            onClick={loginWithGoogle}
            className="bg-primary hover:bg-primary/95 text-primary-foreground text-[10px] py-1 px-3 rounded-lg font-bold shadow-sm whitespace-nowrap"
          >
            Link Google Account
          </button>
        </div>
      )}

      {/* Grid displays */}
      {loading ? (
        <div className="text-center py-20 text-xs text-muted-foreground font-medium">
          <RefreshCw className="w-6 h-6 animate-spin mx-auto text-primary mb-3" />
          Mapping direct connections list...
        </div>
      ) : filtered.length === 0 ? (
        <div className="text-center py-16 border border-dashed border-border rounded-xl text-muted-foreground bg-card">
          <Users className="w-8 h-8 mx-auto stroke-1 text-muted-foreground/50 mb-2" />
          <p className="text-xs font-bold">No contacts found.</p>
          <p className="text-[10px] text-muted-foreground/75 mt-0.5">Contacts added will appear here.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {filtered.map((c) => (
            <div 
              key={c.id} 
              className="p-4 border border-border rounded-2xl hover:border-primary/40 transition-all bg-card hover:bg-secondary/10 shadow-sm relative group overflow-hidden"
            >
              <div className="flex gap-3.5 items-center relative z-10">
                <img 
                  src={c.photoUrl} 
                  className="w-12 h-12 rounded-full object-cover border border-border shadow-inner" 
                  alt={c.name}
                />
                <div className="flex-1 min-w-0">
                  <h4 className="font-extrabold text-sm text-foreground truncate flex items-center gap-1.5">
                    {c.name}
                    <button onClick={(e) => handleToggleStar(c.id, e)} className="text-muted-foreground hover:text-amber-500">
                      <Star className={`w-3.5 h-3.5 ${c.starred ? 'fill-amber-400 text-amber-500' : ''}`} />
                    </button>
                  </h4>
                  <p className="text-[10px] text-muted-foreground flex items-center gap-1 font-semibold mt-0.5"><Mail className="w-3 h-3 text-primary/70 shrink-0" /> {c.email || 'No Email'}</p>
                  <p className="text-[10px] text-muted-foreground flex items-center gap-1 font-semibold mt-0.5"><Phone className="w-3 h-3 text-primary/70 shrink-0" /> {c.phone || 'No Phone'}</p>
                </div>
              </div>

              {c.notes && (
                <div className="mt-3 text-[10px] text-muted-foreground bg-secondary/35 p-2 rounded-lg font-medium border border-border/40">
                  {c.notes}
                </div>
              )}

              {/* Float action row */}
              <div className="mt-4 pt-3 border-t border-border/40 flex justify-end gap-1 relative z-10 opacity-0 group-hover:opacity-100 transition-all">
                <button 
                  onClick={() => handleOpenEdit(c)}
                  className="p-1.5 text-muted-foreground hover:text-foreground rounded-lg hover:bg-secondary"
                  title="Edit contact fields"
                >
                  <Edit className="w-3.5 h-3.5" />
                </button>
                <button 
                  onClick={(e) => handleDeleteContact(c.id, e)}
                  className="p-1.5 text-muted-foreground hover:text-destructive rounded-lg hover:bg-secondary"
                  title="Remove relation catalog"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                </button>
              </div>

            </div>
          ))}
        </div>
      )}

      {/* Editor Modal Popup */}
      {isModalOpen && (
        <div className="fixed inset-0 z-[200] bg-black/60 backdrop-blur-sm flex items-center justify-center p-4" onClick={(e) => e.target === e.currentTarget && setIsModalOpen(false)}>
          <div className="bg-card border border-border w-full max-w-md rounded-2xl shadow-xl overflow-hidden flex flex-col" onClick={e => e.stopPropagation()}>
            <div className="p-4 border-b border-border bg-secondary/5 flex justify-between items-center bg-card">
              <h3 className="font-extrabold text-sm text-foreground flex items-center gap-2">
                <UserPlus className="w-4 h-4 text-primary" /> {editingId ? 'Edit Connection Profile' : 'Add New Contact'}
              </h3>
              <button onClick={() => setIsModalOpen(false)} className="p-1 rounded-lg hover:bg-secondary text-muted-foreground">
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleCreateOrUpdate} className="p-4 space-y-4">
              
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1">
                  <label className="text-[10px] font-bold text-muted-foreground uppercase">First name *</label>
                  <input 
                    type="text" 
                    required
                    placeholder="John" 
                    value={firstName}
                    onChange={e => setFirstName(e.target.value)}
                    className="w-full bg-secondary/30 border border-border rounded-xl p-2 text-xs focus:ring-2 focus:ring-primary/60 outline-none text-foreground font-bold"
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-[10px] font-bold text-muted-foreground uppercase">Last name</label>
                  <input 
                    type="text" 
                    placeholder="Doe" 
                    value={lastName}
                    onChange={e => setLastName(e.target.value)}
                    className="w-full bg-secondary/30 border border-border rounded-xl p-2 text-xs focus:ring-2 focus:ring-primary/60 outline-none text-foreground font-bold"
                  />
                </div>
              </div>

              <div className="space-y-1">
                <label className="text-[10px] font-bold text-muted-foreground uppercase">Email address</label>
                <input 
                  type="email" 
                  placeholder="name@unilive.co" 
                  value={emailInput}
                  onChange={e => setEmailInput(e.target.value)}
                  className="w-full bg-secondary/30 border border-border rounded-xl p-2 text-xs focus:ring-2 focus:ring-primary/60 outline-none text-foreground font-extrabold"
                />
              </div>

              <div className="space-y-1">
                <label className="text-[10px] font-bold text-muted-foreground uppercase">Phone number</label>
                <input 
                  type="text" 
                  placeholder="+1 (555) 700-1100" 
                  value={phoneInput}
                  onChange={e => setPhoneInput(e.target.value)}
                  className="w-full bg-secondary/30 border border-border rounded-xl p-2 text-xs focus:ring-2 focus:ring-primary/60 outline-none text-foreground font-extrabold"
                />
              </div>

              <div className="space-y-1">
                <label className="text-[10px] font-bold text-muted-foreground uppercase">Personal context / notes</label>
                <textarea 
                  rows={3}
                  placeholder="e.g. Lead system designer..." 
                  value={notesInput}
                  onChange={e => setNotesInput(e.target.value)}
                  className="w-full bg-secondary/30 border border-border rounded-xl p-2 text-xs focus:ring-2 focus:ring-primary/60 outline-none text-foreground font-semibold resize-none"
                />
              </div>

              {statusMessage && (
                <div className={`p-3 rounded-lg text-[11px] font-bold flex items-center gap-2 ${
                  statusMessage.type === 'success' ? 'bg-emerald-500/10 text-emerald-600' : 'bg-destructive/10 text-destructive'
                }`}>
                  <CheckCircle2 className="w-4 h-4 shrink-0" />
                  <span>{statusMessage.text}</span>
                </div>
              )}

              <div className="border-t border-border pt-3 flex justify-end gap-2">
                <button 
                  type="button" 
                  onClick={() => setIsModalOpen(false)}
                  className="px-4 py-2 border border-border rounded-xl text-xs font-bold hover:bg-secondary text-muted-foreground"
                >
                  Cancel
                </button>
                <button 
                  type="submit" 
                  disabled={submitting}
                  className="px-4 py-2 bg-primary hover:bg-primary/95 text-primary-foreground text-xs font-bold rounded-xl shadow-md min-w-[80px]"
                >
                  {submitting ? 'Processing...' : 'Save Contact'}
                </button>
              </div>

            </form>
          </div>
        </div>
      )}

    </div>
  );
}
