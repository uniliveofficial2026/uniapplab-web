import React, { useState, useEffect } from 'react';
import { useAuth } from '../../lib/AuthContext';
import { useDB } from '../../lib/useDB';
import { 
  Calendar as CalendarIcon, Video, Plus, Clock, Trash2, X, Search,
  CheckCircle2, RefreshCw, Sparkles, AlertCircle, ArrowUpRight, Check, Play, User
} from 'lucide-react';

interface CalendarEvent {
  id: string;
  summary: string;
  description?: string;
  start: string;
  end: string;
  location?: string;
  hangoutLink?: string;
  attendeesCount?: number;
}

export function GoogleCalendarTab() {
  const { googleAccessToken, loginWithGoogle } = useAuth();
  const db = useDB();
  
  const [subTab, setSubTab] = useState<'calendar' | 'meet'>('calendar');
  const [events, setEvents] = useState<CalendarEvent[]>([]);
  const [loading, setLoading] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');

  // Event creation form state
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [summaryInput, setSummaryInput] = useState('');
  const [descriptionInput, setDescriptionInput] = useState('');
  const [dateTimeInput, setDateTimeInput] = useState('');
  const [durationInput, setDurationInput] = useState('30');
  const [addMeetLink, setAddMeetLink] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [statusMessage, setStatusMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  // Instant Meet Generator State (under Google Meet tab)
  const [instantMeetTitle, setInstantMeetTitle] = useState('');
  const [generatedMeetLink, setGeneratedMeetLink] = useState<string | null>(null);
  const [meetCreating, setMeetCreating] = useState(false);

  // Fallback beautiful seed events
  const seedEvents: CalendarEvent[] = [
    {
      id: 'e1',
      summary: 'Project unilive-ryz8n6 Review',
      description: 'Review database schemas, authentication variables, and secure Firestore rule locks.',
      start: new Date(Date.now() + 1000 * 60 * 60 * 2).toISOString(),
      end: new Date(Date.now() + 1000 * 60 * 60 * 3).toISOString(),
      location: 'Google Meet Video Session',
      hangoutLink: 'https://meet.google.com/ais-pre-unilive',
      attendeesCount: 4
    },
    {
      id: 'e2',
      summary: 'Sarah & Alan 1on1 Deliverables Sync',
      description: 'Discuss custom UI typography pairings (Inter / JetBrains Mono) and dark mode contrast ratios.',
      start: new Date(Date.now() + 100 * 60 * 60 * 1000).toISOString(),
      end: new Date(Date.now() + 101 * 60 * 60 * 1000).toISOString(),
      location: 'Virtual workspace',
      hangoutLink: 'https://meet.google.com/qzw-rfgh-abc',
      attendeesCount: 2
    },
    {
      id: 'e3',
      summary: 'Firestore Rule ESLint & Sec Audit',
      description: 'Reviewing Zero-trust attribute policies and making sure we prevent shadowed updates on database records.',
      start: new Date(Date.now() - 3 * 3600 * 1000).toISOString(),
      end: new Date(Date.now() - 2 * 3600 * 1000).toISOString(),
      location: 'Main Conference Room 4B',
      attendeesCount: 5
    }
  ];

  const fetchCalendarEvents = async () => {
    if (!googleAccessToken) {
      setEvents(seedEvents);
      return;
    }
    setLoading(true);
    try {
      // Fetch calendar events via verified live Google Calendar API
      const timeMin = new Date().toISOString();
      const res = await fetch(`https://www.googleapis.com/calendar/v3/calendars/primary/events?orderBy=startTime&singleEvents=true&timeMin=${timeMin}&maxResults=15`, {
        headers: { Authorization: `Bearer ${googleAccessToken}` }
      });
      if (!res.ok) throw new Error('Failed to retrieve live Google Calendar events.');
      const data = await res.json();
      
      if (!data.items || data.items.length === 0) {
        setEvents([]);
        setLoading(false);
        return;
      }

      const mapped: CalendarEvent[] = data.items.map((item: any) => {
        const startStr = item.start?.dateTime || item.start?.date || '';
        const endStr = item.end?.dateTime || item.end?.date || '';
        return {
          id: item.id,
          summary: item.summary || 'Untitled Event',
          description: item.description || '',
          start: startStr,
          end: endStr,
          location: item.location || '',
          hangoutLink: item.hangoutLink || undefined,
          attendeesCount: item.attendees?.length || 0
        };
      });

      setEvents(mapped);
    } catch (e) {
      console.error('Error fetching Calendar', e);
      setEvents([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchCalendarEvents();
  }, [googleAccessToken]);

  const handleCreateEvent = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!summaryInput.trim() || !dateTimeInput) return;
    setSubmitting(true);
    setStatusMessage(null);

    const startDT = new Date(dateTimeInput);
    const durationMin = parseInt(durationInput, 10) || 30;
    const endDT = new Date(startDT.getTime() + durationMin * 60 * 1000);

    // If client has real OAuth
    if (googleAccessToken) {
      try {
        const eventBody: any = {
          summary: summaryInput.trim(),
          description: descriptionInput.trim(),
          start: { dateTime: startDT.toISOString() },
          end: { dateTime: endDT.toISOString() },
        };

        let queryParam = '';
        if (addMeetLink) {
          queryParam = '?conferenceDataVersion=1';
          eventBody.conferenceData = {
            createRequest: {
              requestId: 'sec-meet-' + Date.now(),
              conferenceSolutionKey: { type: 'hangoutsMeet' }
            }
          };
        }

        const res = await fetch(`https://www.googleapis.com/calendar/v3/calendars/primary/events${queryParam}`, {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${googleAccessToken}`,
            'Content-Type': 'application/json'
          },
          body: JSON.stringify(eventBody)
        });

        if (res.ok) {
          setStatusMessage({ type: 'success', text: 'Activity compiled and posted successfully to Google Calendar!' });
          db.addAuditLog({ id: Date.now(), text: `Posted Google Calendar Event: "${summaryInput.trim()}"`, time: 'Just now' });
          setSummaryInput('');
          setDescriptionInput('');
          setDateTimeInput('');
          setTimeout(() => {
            setIsFormOpen(false);
            fetchCalendarEvents();
          }, 1500);
        } else {
          throw new Error('Google Calendar rejected your entry request parameters.');
        }
      } catch (err: any) {
        setStatusMessage({ type: 'error', text: err.message || 'Transmission failed.' });
      } finally {
        setSubmitting(false);
      }
    } else {
      // Mock event builder with visual success message
      setTimeout(() => {
        const mockNew: CalendarEvent = {
          id: 'mock_e_' + Date.now(),
          summary: summaryInput.trim(),
          description: descriptionInput.trim(),
          start: startDT.toISOString(),
          end: endDT.toISOString(),
          location: addMeetLink ? 'Google Meet Call' : 'Virtual Sync',
          hangoutLink: addMeetLink ? 'https://meet.google.com/mock-meet-' + Math.random().toString(36).substring(3, 12) : undefined,
          attendeesCount: 1
        };

        setEvents(prev => [mockNew, ...prev]);
        setStatusMessage({ type: 'success', text: 'Activity scheduled in mock database cache (Connect account for Google sync).' });
        db.addAuditLog({ id: Date.now(), text: `Created mock event: "${summaryInput.trim()}"`, time: 'Just now' });
        
        setSummaryInput('');
        setDescriptionInput('');
        setDateTimeInput('');
        setTimeout(() => {
          setIsFormOpen(false);
          setStatusMessage(null);
        }, 1800);
        setSubmitting(false);
      }, 800);
    }
  };

  const handleDeleteEvent = async (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    const confirmed = window.confirm('Are you sure you want to cancel and delete this event? This action cannot be undone.');
    if (!confirmed) return;

    if (googleAccessToken) {
      try {
        const res = await fetch(`https://www.googleapis.com/calendar/v3/calendars/primary/events/${id}`, {
          method: 'DELETE',
          headers: { Authorization: `Bearer ${googleAccessToken}` }
        });
        if (res.ok) {
          setEvents(prev => prev.filter(item => item.id !== id));
          db.addAuditLog({ id: Date.now(), text: `Canceled synced event.`, time: 'Just now' });
        } else {
          throw new Error('Server rejected event canceling permission');
        }
      } catch (err: any) {
        alert(err.message || 'Failed to cancel synchronized meeting.');
      }
    } else {
      setEvents(prev => prev.filter(item => item.id !== id));
      db.addAuditLog({ id: Date.now(), text: `Canceled local mock event.`, time: 'Just now' });
    }
  };

  const handleCreateInstantMeet = async (e: React.FormEvent) => {
    e.preventDefault();
    const title = instantMeetTitle.trim() || 'Instant Workspace Sync';
    setMeetCreating(true);
    setGeneratedMeetLink(null);

    if (googleAccessToken) {
      try {
        const start = new Date();
        const end = new Date(start.getTime() + 45 * 60 * 1000); // 45 min slot

        const meetEvent = {
          summary: title,
          description: 'Secure meeting room initialized using Google Meet Workspace API.',
          start: { dateTime: start.toISOString() },
          end: { dateTime: end.toISOString() },
          conferenceData: {
            createRequest: {
              requestId: 'meet-instant-' + Date.now(),
              conferenceSolutionKey: { type: 'hangoutsMeet' }
            }
          }
        };

        const res = await fetch('https://www.googleapis.com/calendar/v3/calendars/primary/events?conferenceDataVersion=1', {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${googleAccessToken}`,
            'Content-Type': 'application/json'
          },
          body: JSON.stringify(meetEvent)
        });

        if (res.ok) {
          const resData = await res.json();
          if (resData.hangoutLink) {
            setGeneratedMeetLink(resData.hangoutLink);
            const startIso = resData.start?.dateTime || resData.start?.date || new Date().toISOString();
            const endIso = resData.end?.dateTime || resData.end?.date || new Date(Date.now() + 45 * 60 * 1000).toISOString();
            setEvents((prev) => [
              {
                id: resData.id || `meet-${Date.now()}`,
                summary: resData.summary || title,
                description: resData.description || '',
                start: startIso,
                end: endIso,
                hangoutLink: resData.hangoutLink,
                attendeesCount: resData.attendees?.length || 0,
              },
              ...prev,
            ]);
            db.addAuditLog({ id: Date.now(), text: `Created dynamic Google Meet space: "${title}"`, time: 'Just now' });
          } else {
            throw new Error('Meeting conference space failed to allocate hangout link.');
          }
        } else {
          throw new Error('Google Meet server denied event creation permission.');
        }
      } catch (err: any) {
        alert(err.message || 'Error scheduling instant Google Meet.');
      } finally {
        setMeetCreating(false);
      }
    } else {
      // Mock Meet Generator
      setTimeout(() => {
        const mockMeet = 'https://meet.google.com/unilive-' + Math.random().toString(36).substring(2, 5) + '-' + Math.random().toString(36).substring(5, 9) + '-' + Math.random().toString(36).substring(9, 12);
        setGeneratedMeetLink(mockMeet);
        db.addAuditLog({ id: Date.now(), text: `Created offline mock Meet room: "${title}"`, time: 'Just now' });
        setMeetCreating(false);
      }, 1000);
    }
  };

  const filteredEvents = events.filter(e => 
    e.summary.toLowerCase().includes(searchQuery.toLowerCase()) ||
    (e.description && e.description.toLowerCase().includes(searchQuery.toLowerCase()))
  );

  return (
    <div className="space-y-6">
      
      {/* Sub Tabs Selector */}
      <div className="flex border-b border-border gap-6 max-w-md">
        <button 
          onClick={() => setSubTab('calendar')}
          className={`pb-3 text-sm font-extrabold flex items-center gap-2 border-b-2 transition ${
            subTab === 'calendar' ? 'border-primary text-foreground' : 'border-transparent text-muted-foreground hover:text-foreground'
          }`}
        >
          <CalendarIcon className="w-4 h-4" /> Calendar & Events ({events.length})
        </button>
        <button 
          onClick={() => setSubTab('meet')}
          className={`pb-3 text-sm font-extrabold flex items-center gap-2 border-b-2 transition ${
            subTab === 'meet' ? 'border-primary text-foreground' : 'border-transparent text-muted-foreground hover:text-foreground'
          }`}
        >
          <Video className="w-4 h-4 text-red-500" /> Google Meet Video Calls
        </button>
      </div>

      {subTab === 'calendar' ? (
        <React.Fragment>
          {/* Calendar Controller Bar */}
          <div className="border border-border bg-card rounded-2xl p-4 sm:p-6 shadow-sm flex flex-col md:flex-row justify-between items-stretch md:items-center gap-4">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-emerald-500/10 rounded-xl text-emerald-500">
                <CalendarIcon className="w-5 h-5" />
              </div>
              <div>
                <h3 className="font-extrabold text-foreground text-sm flex items-center gap-2">
                  My Live Schedule 
                  {googleAccessToken && <span className="bg-emerald-500/10 text-emerald-600 text-[10px] px-2 py-0.5 rounded-full font-bold">Live Synced</span>}
                </h3>
                <p className="text-[11px] text-muted-foreground">Keep your deliverables, sprint meetings, and Google Meet tags locked</p>
              </div>
            </div>

            <div className="flex flex-col sm:flex-row gap-3">
              <div className="relative w-full sm:w-64">
                <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
                <input 
                  type="text" 
                  value={searchQuery}
                  onChange={e => setSearchQuery(e.target.value)}
                  placeholder="Filter schedule titles..."
                  className="w-full bg-secondary/45 border border-border rounded-xl pl-9 p-2 text-xs font-semibold focus:outline-none focus:ring-2 focus:ring-primary/45 outline-none text-foreground"
                />
              </div>
              <button 
                onClick={() => setIsFormOpen(true)}
                className="px-4 py-2 bg-primary hover:bg-primary/95 text-primary-foreground font-bold text-xs rounded-xl shadow flex items-center justify-center gap-1.5 shadow-sm whitespace-nowrap self-stretch sm:self-auto"
              >
                <Plus className="w-4 h-4" /> Book Event
              </button>
            </div>
          </div>

          {/* Banner alert if not logged in with account */}
          {!googleAccessToken && (
            <div className="p-3 bg-primary/5 rounded-xl border border-primary/10 text-[11px] font-semibold text-foreground flex justify-between items-center gap-3">
              <span>Displaying local system timetable. Connect your Google account for live Google Calendar read/writes.</span>
              <button 
                onClick={loginWithGoogle}
                className="bg-primary hover:bg-primary/95 text-primary-foreground text-[10px] py-1 px-3 rounded-lg font-bold shadow-sm whitespace-nowrap"
              >
                Link Calendar
              </button>
            </div>
          )}

          {/* Timetable Items */}
          {loading ? (
            <div className="text-center py-20 text-xs text-muted-foreground font-medium">
              <RefreshCw className="w-6 h-6 animate-spin mx-auto text-primary mb-3" />
              Parsing schedule matrix...
            </div>
          ) : filteredEvents.length === 0 ? (
            <div className="text-center py-20 border border-dashed border-border rounded-2xl bg-card">
              <CalendarIcon className="w-9 h-9 stroke-1 text-muted-foreground/50 mx-auto mb-2" />
              <p className="text-xs font-bold text-foreground">Agenda is entirely empty</p>
              <p className="text-[10px] text-muted-foreground mt-0.5">Book an event to occupy this timeframe.</p>
            </div>
          ) : (
            <div className="divide-y divide-border border border-border rounded-2xl overflow-hidden bg-card shadow-sm">
              {filteredEvents.map((event) => {
                const startDate = new Date(event.start);
                const endDate = new Date(event.end);
                
                return (
                  <div 
                    key={event.id}
                    className="p-4 sm:p-5 hover:bg-secondary/10 hover:shadow-inner transition-all flex flex-col md:flex-row md:items-center justify-between gap-4 group bg-card"
                  >
                    <div className="flex gap-4 items-start">
                      {/* Left Block: Date/Time badge */}
                      <div className="w-12 h-12 bg-primary/5 border border-primary/10 rounded-xl flex flex-col items-center justify-center text-primary font-black shrink-0">
                        <span className="text-[10px] uppercase font-bold tracking-wider">{startDate.toLocaleDateString([], { month: 'short' })}</span>
                        <span className="text-sm -mt-1">{startDate.toLocaleDateString([], { day: '2-digit' })}</span>
                      </div>

                      {/* Middle Block: Event metadata */}
                      <div className="space-y-1 min-w-0">
                        <h4 className="font-extrabold text-sm text-foreground group-hover:text-primary transition-colors truncate">
                          {event.summary}
                        </h4>
                        <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-[11px] text-muted-foreground font-medium">
                          <span className="flex items-center gap-1"><Clock className="w-3.5 h-3.5" /> {startDate.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })} - {endDate.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
                          {event.location && <span className="text-foreground/80 truncate">• Location: {event.location}</span>}
                          {event.attendeesCount !== undefined && event.attendeesCount > 0 && <span className="bg-secondary px-1.5 py-0.5 rounded text-[9px] font-bold shrink-0">{event.attendeesCount} RSVP</span>}
                        </div>
                        {event.description && (
                          <p className="text-[11px] text-muted-foreground/85 line-clamp-1 mt-1 font-semibold">
                            {event.description}
                          </p>
                        )}
                      </div>
                    </div>

                    {/* Right Block: Dynamic launch buttons */}
                    <div className="flex items-center gap-3 shrink-0 self-end md:self-auto pt-2 md:pt-0">
                      {event.hangoutLink && (
                        <a 
                          href={event.hangoutLink} 
                          target="_blank" 
                          rel="noreferrer referrer"
                          className="px-3.5 py-1.5 bg-red-500 hover:bg-red-600 text-white font-extrabold text-xs rounded-xl shadow-md flex items-center gap-1.5 transition-all text-center"
                        >
                          <Video className="w-3.5 h-3.5 fill-white/20" /> Join Google Meet
                        </a>
                      )}
                      
                      <button 
                        onClick={(e) => handleDeleteEvent(event.id, e)}
                        className="p-2 text-muted-foreground hover:text-destructive hover:bg-secondary/50 rounded-xl transition-all opacity-100 md:opacity-0 group-hover:opacity-100"
                        title="Cancel synchronized event"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>

                  </div>
                );
              })}
            </div>
          )}

          {/* Form Dialog modal block */}
          {isFormOpen && (
            <div className="fixed inset-0 z-[200] bg-black/60 backdrop-blur-sm flex items-center justify-center p-4" onClick={(e) => e.target === e.currentTarget && setIsFormOpen(false)}>
              <div className="bg-card border border-border w-full max-w-md rounded-2xl shadow-xl overflow-hidden flex flex-col" onClick={e => e.stopPropagation()}>
                <div className="p-4 border-b border-border bg-secondary/5 flex justify-between items-center bg-card">
                  <h3 className="font-extrabold text-sm text-foreground flex items-center gap-2">
                    <CalendarIcon className="w-4 h-4 text-primary" /> Schedule Calendar Event
                  </h3>
                  <button onClick={() => setIsFormOpen(false)} className="p-1 rounded-lg hover:bg-secondary text-muted-foreground">
                    <X className="w-4 h-4" />
                  </button>
                </div>

                <form onSubmit={handleCreateEvent} className="p-4 space-y-4">
                  
                  <div className="space-y-1">
                    <label className="text-[10px] font-bold text-muted-foreground uppercase">Event title *</label>
                    <input 
                      type="text" 
                      required
                      placeholder="e.g. Design Sync / Sprint Review" 
                      value={summaryInput}
                      onChange={e => setSummaryInput(e.target.value)}
                      className="w-full bg-secondary/30 border border-border rounded-xl p-2.5 text-xs focus:ring-2 focus:ring-primary/60 outline-none text-foreground font-bold"
                    />
                  </div>

                  <div className="space-y-1">
                    <label className="text-[10px] font-bold text-muted-foreground uppercase">Context description</label>
                    <textarea 
                      rows={2}
                      placeholder="e.g. Discuss deployment variables..." 
                      value={descriptionInput}
                      onChange={e => setDescriptionInput(e.target.value)}
                      className="w-full bg-secondary/30 border border-border rounded-xl p-2.5 text-xs focus:ring-2 focus:ring-primary/60 outline-none text-foreground font-semibold resize-none"
                    />
                  </div>

                  <div className="grid grid-cols-2 gap-3">
                    <div className="space-y-1">
                      <label className="text-[10px] font-bold text-muted-foreground uppercase">Date & Start Time *</label>
                      <input 
                        type="datetime-local" 
                        required
                        value={dateTimeInput}
                        onChange={e => setDateTimeInput(e.target.value)}
                        className="w-full bg-secondary/30 border border-border rounded-xl p-2 text-xs focus:ring-2 focus:ring-primary/60 outline-none text-foreground font-bold"
                      />
                    </div>
                    <div className="space-y-1">
                      <label className="text-[10px] font-bold text-muted-foreground uppercase">Duration (mins)</label>
                      <select 
                        value={durationInput} 
                        onChange={e => setDurationInput(e.target.value)}
                        className="w-full bg-secondary/30 border border-border rounded-xl p-2 text-xs focus:ring-2 focus:ring-primary/60 outline-none text-foreground font-bold"
                      >
                        <option value="15">15 Minutes</option>
                        <option value="30">30 Minutes</option>
                        <option value="45">45 Minutes</option>
                        <option value="60">1 Hour</option>
                        <option value="120">2 Hours</option>
                      </select>
                    </div>
                  </div>

                  <div className="p-3 bg-secondary/40 rounded-xl border border-border/40 flex justify-between items-center">
                    <div className="flex items-center gap-2">
                      <Video className="w-4 h-4 text-red-500" />
                      <div>
                        <p className="text-xs font-bold text-foreground">Attach Google Meet Link</p>
                        <p className="text-[9px] text-muted-foreground">Generates a live meeting space URL</p>
                      </div>
                    </div>
                    <label className="relative inline-flex items-center cursor-pointer">
                      <input 
                        type="checkbox" 
                        checked={addMeetLink} 
                        onChange={e => setAddMeetLink(e.target.checked)} 
                        className="sr-only peer" 
                      />
                      <div className="w-9 h-5 bg-secondary peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-primary"></div>
                    </label>
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
                      onClick={() => setIsFormOpen(false)}
                      className="px-4 py-2 border border-border rounded-xl text-xs font-bold hover:bg-secondary text-muted-foreground"
                    >
                      Discard
                    </button>
                    <button 
                      type="submit" 
                      disabled={submitting}
                      className="px-4 py-2 bg-primary hover:bg-primary/95 text-primary-foreground text-xs font-bold rounded-xl shadow-md min-w-[80px]"
                    >
                      {submitting ? 'Transmitting...' : 'Confirm Book'}
                    </button>
                  </div>

                </form>
              </div>
            </div>
          )}

        </React.Fragment>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-12 gap-6 items-start">
          
          {/* Left panel: Meet Generator */}
          <div className="md:col-span-5 border border-border bg-card rounded-2xl p-5 sm:p-6 shadow-sm space-y-4">
            <div className="flex items-center gap-2 mb-2">
              <div className="p-2 bg-red-500/10 text-red-500 rounded-xl">
                <Video className="w-5 h-5 fill-red-500/20" />
              </div>
              <div>
                <h4 className="font-extrabold text-sm text-foreground">Launch Google Meet</h4>
                <p className="text-[10px] text-muted-foreground">Provision an instant, high-fidelity secure workspace video call</p>
              </div>
            </div>

            <form onSubmit={handleCreateInstantMeet} className="space-y-4 pt-1">
              <div className="space-y-1">
                <label className="text-[10px] font-bold text-muted-foreground uppercase">Instant Call Title</label>
                <input 
                  type="text" 
                  value={instantMeetTitle}
                  onChange={e => setInstantMeetTitle(e.target.value)}
                  placeholder="e.g. Design Sprint sync"
                  className="w-full bg-secondary/35 border border-border rounded-xl p-2.5 text-xs text-foreground font-semibold focus:outline-none focus:ring-2 focus:ring-red-500/40"
                />
              </div>

              <button 
                type="submit"
                disabled={meetCreating}
                className="w-full py-2.5 bg-red-500 hover:bg-red-600 font-extrabold text-xs text-white rounded-xl shadow-md transition-all flex items-center justify-center gap-2"
              >
                {meetCreating ? <RefreshCw className="w-4 h-4 animate-spin" /> : <Video className="w-4 h-4 fill-white/20" />}
                {meetCreating ? 'Allocating Conference ID...' : 'Start Instant Meet Call'}
              </button>
            </form>

            {generatedMeetLink && (
              <div className="p-4 bg-emerald-500/5 rounded-2xl border border-emerald-500/20 space-y-3 mt-4 animate-in fade-in duration-300">
                <div className="flex gap-2 items-center text-emerald-600">
                  <Check className="w-4.5 h-4.5 bg-emerald-500/10 rounded-full p-0.5 shrink-0" />
                  <span className="text-xs font-bold">Space generated!</span>
                </div>
                <p className="text-[10px] text-muted-foreground font-medium">Your meeting URL is locked and ready for distribution:</p>
                <input 
                  type="text" 
                  readOnly 
                  value={generatedMeetLink}
                  onClick={e => (e.target as any).select()}
                  className="w-full bg-secondary/60 border border-border rounded-xl p-2 text-xs font-mono text-center text-foreground font-semibold outline-none selection:bg-emerald-200"
                />
                <a 
                  href={generatedMeetLink}
                  target="_blank"
                  rel="noreferrer referrer"
                  className="w-full py-2 bg-foreground text-background hover:bg-foreground/80 font-bold text-xs rounded-xl flex items-center justify-center gap-1.5 transition mt-2 cursor-pointer text-center"
                >
                  <Play className="w-3.5 h-3.5 fill-current" /> Join Room Now
                </a>
              </div>
            )}
          </div>

          {/* Right panel: Active virtual meets */}
          <div className="md:col-span-7 border border-border bg-card rounded-2xl p-5 sm:p-6 shadow-sm space-y-4">
            <h4 className="font-extrabold text-xs text-foreground uppercase tracking-wider">Active Video Rooms</h4>
            <div className="space-y-3">
              {events.filter(e => e.hangoutLink).length === 0 ? (
                <div className="text-center py-12 text-muted-foreground">
                  <p className="text-xs font-bold">No active meets scheduled today.</p>
                  <p className="text-[10px] text-muted-foreground/80 mt-0.5">Use the Calendar scheduler or instant builder to start one.</p>
                </div>
              ) : (
                events.filter(e => e.hangoutLink).map((e) => (
                  <div 
                    key={e.id}
                    className="p-3.5 border border-border rounded-2xl bg-secondary/5 hover:border-red-500/35 transition flex justify-between items-center gap-3"
                  >
                    <div className="min-w-0">
                      <h5 className="font-extrabold text-xs text-foreground truncate">{e.summary}</h5>
                      <p className="text-[10px] text-muted-foreground font-semibold flex items-center gap-1 mt-1"><Clock className="w-3 h-3" /> {new Date(e.start).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })} • Synced via Workspace</p>
                    </div>
                    <a 
                      href={e.hangoutLink}
                      target="_blank"
                      rel="noreferrer referrer"
                      className="px-3.5 py-1.5 bg-red-500 hover:bg-red-600 text-white font-extrabold text-xs rounded-xl shadow-md shrink-0 flex items-center gap-1.5 transition"
                    >
                      <ArrowUpRight className="w-3.5 h-3.5" /> Launch
                    </a>
                  </div>
                ))
              )}
            </div>
          </div>

        </div>
      )}

    </div>
  );
}
