import { useState, useEffect } from 'react';
import { 
  FileSpreadsheet, Search, AlertCircle, 
  Database, RefreshCw, UserCheck, ShieldAlert, 
  Key, Eye, Clipboard, Check, Filter
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { User } from 'firebase/auth';

import { 
  fetchPublicSpreadsheetContacts, 
  extractSpreadsheetId,
  ensureVoteColumnsInSpreadsheet,
  incrementSpreadsheetVote
} from './lib/sheets';
import { fetchAllSpreadsheetVotes, recordVoteInFirestore } from './lib/db';
import { initAuth, googleSignIn, logout, getAccessToken } from './lib/auth';
import { Contact, SpreadsheetFile } from './types';
import { PhoneFrame } from './components/PhoneFrame';
import { ContactCard } from './components/ContactCard';

// ==========================================
// ⚙️ HARDCODED SPREADSHEET CONFIGURATION:
// Paste your Google Spreadsheet URL or copy its unique spreadsheet ID here directly!
// By hardcoding this here, the application will load this spreadsheet immediately upon start.
// ==========================================
const HARDCODED_SPREADSHEET_ID = "1dN6bkj48B126yAQ4mDZbchr27qOmC52dmH4TFRwUrPU";

// CONFIGURATION: Set your Google Spreadsheet ID or complete URL here (via build environment)
const SPREADSHEET_SOURCE_ENV = (import.meta as any).env?.VITE_CONTACTS_SPREADSHEET_ID || "";

export default function App() {
  const [spreadsheetSource, setSpreadsheetSource] = useState(() => {
    return SPREADSHEET_SOURCE_ENV || HARDCODED_SPREADSHEET_ID;
  });
  const [selectedSpreadsheet, setSelectedSpreadsheet] = useState<SpreadsheetFile | null>(null);
  const [sheetTabName, setSheetTabName] = useState<string>('');
  
  // Auth state
  const [currentUser, setCurrentUser] = useState<User | null>(null);
  const [accessToken, setAccessToken] = useState<string | null>(null);
  const [isLoggingIn, setIsLoggingIn] = useState(false);

  // Contacts data state
  const [contacts, setContacts] = useState<Contact[]>([]);
  const [isLoadingContacts, setIsLoadingContacts] = useState(false);
  const [contactsError, setContactsError] = useState<string | null>(null);
  const [isReloading, setIsReloading] = useState(false);

  // Live filter state
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('All');

  // Clipboard copy state for helpful instructions
  const [copiedText, setCopiedText] = useState(false);

  // 1. Listen to Firebase and Google Auth state
  useEffect(() => {
    const unsubscribe = initAuth(
      async (user, token) => {
        setCurrentUser(user);
        setAccessToken(token);
        
        // When user signs in, trigger column check if spreadsheet is linked
        if (spreadsheetSource.trim()) {
          const resolvedId = extractSpreadsheetId(spreadsheetSource) || spreadsheetSource.trim();
          if (contacts.length > 0) {
            const keys = Object.keys(contacts[0].raw || {});
            if (keys.length > 0) {
              await ensureVoteColumnsInSpreadsheet(token, resolvedId, sheetTabName, keys);
            }
          }
        }
      },
      () => {
        setCurrentUser(null);
        setAccessToken(null);
      }
    );
    return () => {
      if (typeof unsubscribe === 'function') {
        unsubscribe();
      }
    };
  }, [contacts, sheetTabName, spreadsheetSource]);

  // 2. On Source Change: Resolve and load spreadsheet if provided
  useEffect(() => {
    if (spreadsheetSource.trim()) {
      const resolvedId = extractSpreadsheetId(spreadsheetSource) || spreadsheetSource.trim();
      
      // Load from local cache for instant visual render
      try {
        const cacheKey = `contacts_cache_${resolvedId}`;
        const cached = localStorage.getItem(cacheKey);
        if (cached) {
          const parsed = JSON.parse(cached);
          if (Array.isArray(parsed) && parsed.length > 0) {
            setContacts(parsed);
            setSelectedSpreadsheet({
              id: resolvedId,
              name: "Connected Live Sheet",
              modifiedTime: new Date().toISOString()
            });
          }
        }
      } catch (e) {
        console.warn('Failed to parse cached contacts:', e);
      }

      loadPublicSheet(resolvedId, "Connected Live Sheet");
    } else {
      setContacts([]);
      setSelectedSpreadsheet(null);
    }
  }, [spreadsheetSource]);

  // 3. Helper to fetch live CSV and merge Firestore vote counts
  const loadPublicSheet = async (sheetId: string, nameFallback: string, customTab?: string) => {
    setIsLoadingContacts(true);
    setContactsError(null);
    try {
      const activeTab = customTab || '';
      
      // Concurrently fetch the spreadsheet contacts and Firestore vote overlay
      const [parsedContacts, firestoreVotes] = await Promise.all([
        fetchPublicSpreadsheetContacts(sheetId, activeTab),
        fetchAllSpreadsheetVotes(sheetId)
      ]);

      const mergedContacts = parsedContacts.map((contact) => {
        const voteKey = `${sheetId}_${(contact.name || '').trim().toLowerCase().replace(/[^a-z0-9]/g, '_')}_${(contact.phone || '').trim().toLowerCase().replace(/[^a-z0-9]/g, '_')}`;
        const fVotes = firestoreVotes[voteKey];
        if (fVotes) {
          contact.thumbsUp = Math.max(contact.thumbsUp || 0, fVotes.thumbsUp || 0);
          contact.thumbsDown = Math.max(contact.thumbsDown || 0, fVotes.thumbsDown || 0);
        }
        return contact;
      });

      const fileObj: SpreadsheetFile = {
        id: sheetId,
        name: nameFallback,
        modifiedTime: new Date().toISOString()
      };

      setSelectedSpreadsheet(fileObj);
      setContacts(mergedContacts);
      setSelectedCategory('All');
      setSheetTabName(activeTab);

      // Save to localStorage for the next instantaneous boot
      try {
        localStorage.setItem(`contacts_cache_${sheetId}`, JSON.stringify(mergedContacts));
      } catch (e) {
        console.warn('Failed to save contacts of spreadsheet to cache:', e);
      }

      // Check if logged in editor token is active, and ensure cols exist in the background (non-blocking)
      const activeToken = accessToken || (await getAccessToken());
      if (activeToken && mergedContacts.length > 0) {
        const headers = Object.keys(mergedContacts[0].raw || {});
        ensureVoteColumnsInSpreadsheet(activeToken, sheetId, activeTab, headers).catch((err) => {
          console.warn('Background check for vote columns failed:', err);
        });
      }
    } catch (err: any) {
      console.error(err);
      setContactsError(err.message || 'Could not fetch public spreadsheet database. Verify sheet sharing and ensure it is set as "Anyone with the link can view".');
    } finally {
      setIsLoadingContacts(false);
    }
  };

  // 4. Sync / Refresh action
  const handleReload = async () => {
    if (!selectedSpreadsheet || selectedSpreadsheet.id === 'demo') return;
    setIsReloading(true);
    try {
      await loadPublicSheet(selectedSpreadsheet.id, selectedSpreadsheet.name, sheetTabName);
    } catch (err) {
      console.error(err);
    } finally {
      setIsReloading(false);
    }
  };

  // 5. Handle vote clicks
  const handleVote = async (contactId: string, voteType: 'up' | 'down') => {
    if (!selectedSpreadsheet) return;
    
    const targetContact = contacts.find((c) => c.id === contactId);
    if (!targetContact) return;

    // Optimistically update standard react state so responsiveness is instantaneous
    setContacts((prev) =>
      prev.map((c) => {
        if (c.id === contactId) {
          return {
            ...c,
            thumbsUp: voteType === 'up' ? (c.thumbsUp || 0) + 1 : c.thumbsUp || 0,
            thumbsDown: voteType === 'down' ? (c.thumbsDown || 0) + 1 : c.thumbsDown || 0,
          };
        }
        return c;
      })
    );

    try {
      const sheetId = selectedSpreadsheet.id;

      // First, write the vote synchronously in Firestore database for public users
      const freshVotes = await recordVoteInFirestore(
        sheetId,
        targetContact.name,
        targetContact.phone,
        voteType
      );

      // Re-align exact numbers with firestore database sync output
      setContacts((prev) =>
        prev.map((c) => {
          if (c.id === contactId) {
            return {
              ...c,
              thumbsUp: freshVotes.thumbsUp,
              thumbsDown: freshVotes.thumbsDown,
            };
          }
          return c;
        })
      );

      // Second, sync to Google Sheet directly if authorized editor is logged in
      const activeToken = accessToken || (await getAccessToken());
      if (activeToken) {
        const headers = Object.keys(targetContact.raw || {});
        const lowerHeaders = headers.map((h) => h.toLowerCase());
        
        // Find existing indices
        let thumbsUpColIdx = lowerHeaders.findIndex((h) => h.includes('thumbs up') || h === 'likes' || h === 'votes');
        let thumbsDownColIdx = lowerHeaders.findIndex((h) => h.includes('thumbs down') || h === 'dislikes');

        // Ensure columns exist or get indices
        if (thumbsUpColIdx === -1 || thumbsDownColIdx === -1) {
          const generatedIndexes = await ensureVoteColumnsInSpreadsheet(
            activeToken,
            sheetId,
            sheetTabName,
            headers
          );
          thumbsUpColIdx = generatedIndexes.thumbsUpIdx;
          thumbsDownColIdx = generatedIndexes.thumbsDownIdx;
        }

        const colIdxToUpdate = voteType === 'up' ? thumbsUpColIdx : thumbsDownColIdx;
        const valueToUpdate = voteType === 'up' ? freshVotes.thumbsUp : freshVotes.thumbsDown;

        if (colIdxToUpdate !== -1) {
          await incrementSpreadsheetVote(
            activeToken,
            sheetId,
            sheetTabName,
            targetContact.rowIndex,
            colIdxToUpdate,
            valueToUpdate
          );
        }
      }
    } catch (e) {
      console.error('Failure saving vote metrics:', e);
    }
  };

  const copyToClipboard = () => {
    navigator.clipboard.writeText('VITE_CONTACTS_SPREADSHEET_ID');
    setCopiedText(true);
    setTimeout(() => setCopiedText(false), 2000);
  };

  // Extract unique custom Categories (Type of Service)
  const uniqueServices = Array.from(new Set(contacts.map((c) => c.service)))
    .filter((s): s is string => !!s)
    .sort((a, b) => a.localeCompare(b));
  const categories = ['All', ...uniqueServices];

  // Filter contacts locally dynamically
  const filteredContacts = contacts.filter((c) => {
    const matchesSearch = 
      c.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      c.phone.toLowerCase().includes(searchQuery.toLowerCase()) ||
      c.email.toLowerCase().includes(searchQuery.toLowerCase()) ||
      c.company.toLowerCase().includes(searchQuery.toLowerCase()) ||
      c.notes.toLowerCase().includes(searchQuery.toLowerCase());
    
    if (selectedCategory === 'All') return matchesSearch;
    return c.service === selectedCategory && matchesSearch;
  }).sort((a, b) => {
    const labelA = a.name && a.company ? `${a.name} - ${a.company}` : (a.name || a.company || 'Unnamed Contact');
    const labelB = b.name && b.company ? `${b.name} - ${b.company}` : (b.name || b.company || 'Unnamed Contact');
    return labelA.localeCompare(labelB);
  });

  return (
    <PhoneFrame>
      <div className="flex-1 flex flex-col h-full bg-slate-200 overflow-hidden">
        
        {/* Nav & Header bar */}
        <div className="bg-slate-50 border-b border-slate-300 py-2 px-3.5 shrink-0 flex items-center justify-between gap-2 shadow-sm">
          <div className="flex items-center gap-2 overflow-hidden">
            <Database size={16} className="text-emerald-650 shrink-0" />
            <div className="overflow-hidden">
              <h1 className="text-xs font-bold text-slate-900 tracking-tight truncate">
                {!spreadsheetSource ? 'Contacts Directory' : 'Service Contacts'}
              </h1>
              <p className="text-[9px] text-emerald-650 font-semibold font-mono uppercase tracking-wide">
                {!spreadsheetSource
                  ? 'Awaiting Connection'
                  : isLoadingContacts
                    ? 'Syncing...'
                    : 'Synced Real-time'}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-1.5 shrink-0">
            {selectedSpreadsheet && (
              <button
                onClick={handleReload}
                disabled={isLoadingContacts || isReloading}
                className={`p-1.5 bg-white hover:bg-slate-100 text-slate-700 disabled:text-slate-400 border border-slate-300 rounded-lg transition-all active:scale-95 flex items-center justify-center cursor-pointer ${isReloading || (isLoadingContacts && contacts.length > 0) ? 'animate-spin' : ''}`}
                title="Sync spreadsheet values"
                id="btn-reload-sheet"
              >
                <RefreshCw size={12} />
              </button>
            )}
          </div>
        </div>

        {/* Dynamic Display depending on Spreadsheet Source existence */}
        {!spreadsheetSource ? (
          /* Case A: Spreadsheet ID is blank - Show prominent instructions to define the hardcoded constant */
          <div className="flex-1 overflow-y-auto p-6 space-y-5 flex flex-col justify-center bg-slate-200">
            <div className="text-center space-y-2">
              <div className="w-12 h-12 rounded-full bg-rose-50 border border-rose-100 flex items-center justify-center text-rose-500 mx-auto shadow-xs">
                <FileSpreadsheet size={24} />
              </div>
              <h2 className="text-base font-bold text-slate-800 tracking-tight">No Spreadsheet Connected</h2>
              <p className="text-xs text-slate-500 max-w-xs mx-auto leading-relaxed">
                Please edit the <code className="bg-slate-300 px-1 py-0.5 rounded text-rose-700 font-mono font-bold text-[10px]">HARDCODED_SPREADSHEET_ID</code> constant in <code className="bg-slate-300 px-1 py-0.5 rounded text-rose-700 font-mono font-bold text-[10px]">src/App.tsx</code> to paste your Google Spreadsheet ID or URL.
              </p>
            </div>
          </div>
        ) : (
          /* Case B: Spreadsheet ID is configured - Load catalogue viewer */
          <div className="flex-1 flex flex-col overflow-hidden relative bg-slate-200">
            {isLoadingContacts && contacts.length === 0 ? (
              <div className="flex-1 flex flex-col items-center justify-center text-center p-6 space-y-4">
                <div className="w-10 h-10 rounded-full border-2 border-emerald-100 border-t-emerald-500 animate-spin" />
                <p className="text-xs text-slate-500 font-semibold font-mono">Syncing sheet columns...</p>
              </div>
            ) : contactsError && contacts.length === 0 ? (
              <div className="flex-1 flex flex-col justify-center px-8 py-10 text-center space-y-4 max-w-sm mx-auto">
                <div className="w-12 h-12 rounded-full bg-rose-50 border border-rose-100 flex items-center justify-center text-rose-500 mx-auto shadow-2xs">
                  <ShieldAlert size={22} />
                </div>
                <div className="space-y-1">
                  <p className="text-sm font-bold text-slate-800">Synchronization Error</p>
                  <p className="text-xs text-slate-500 leading-relaxed">{contactsError}</p>
                </div>
                <button
                  onClick={handleReload}
                  className="mt-2 bg-white hover:bg-slate-50 text-slate-800 border border-slate-300 shadow-2xs font-bold text-xs py-2.5 px-4 rounded-xl transition-all cursor-pointer inline-flex items-center gap-1.5 mx-auto"
                >
                  <RefreshCw size={12} />
                  Try Again
                </button>
              </div>
            ) : (
              <div className="flex-1 flex flex-col overflow-hidden">
                
                {/* Search filters and Category selection */}
                <div className="py-2.5 px-3.5 bg-slate-50 border-b border-slate-300 shrink-0 space-y-2 shadow-2xs z-10 animate-fade-in mb-0.5">
                  {contactsError && (
                    <div className="p-2 bg-rose-50 border border-rose-100 rounded-lg text-rose-600 text-[9px] flex gap-2 items-start mb-1 animate-fade-in">
                      <AlertCircle size={12} className="shrink-0 mt-0.5" />
                      <span>Using cached values. Live sync error: {contactsError}</span>
                    </div>
                  )}

                  {/* Search query input */}
                  <div className="relative">
                    <Search size={13} className="absolute left-2.5 top-1/2 transform -translate-y-1/2 text-slate-400" />
                    <input
                      type="text"
                      placeholder={`Filter ${contacts.length} entries...`}
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                      className="w-full bg-white border border-slate-300 focus:border-slate-400 focus:ring-1 focus:ring-slate-300 rounded-lg py-1.5 px-8 text-xs text-slate-800 placeholder-slate-400 outline-none transition-all font-sans"
                      id="input-contacts-filter"
                    />
                    {searchQuery && (
                      <button
                        onClick={() => setSearchQuery('')}
                        className="absolute right-2.5 top-1/2 transform -translate-y-1/2 text-slate-400 hover:text-slate-600"
                      >
                        <svg className="h-3 w-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M6 18L18 6M6 6l12 12" />
                        </svg>
                      </button>
                    )}
                  </div>

                  {/* Category Dropdown Selector representing filtering options */}
                  <div className="relative">
                    <select
                      id="category-dropdown"
                      value={selectedCategory}
                      onChange={(e) => setSelectedCategory(e.target.value)}
                      className="w-full bg-white border border-slate-300 focus:border-slate-400 focus:ring-1 focus:ring-slate-300 rounded-lg py-1.5 px-8 text-xs text-slate-700 font-bold bg-none outline-none cursor-pointer appearance-none transition-all shadow-3xs"
                    >
                      {categories.map((cat) => {
                        const isAll = cat === 'All';
                        const matchCount = isAll 
                          ? contacts.length 
                          : contacts.filter((c) => c.service === cat).length;
                        return (
                          <option key={cat} value={cat}>
                            {isAll ? `Show All Groups (${matchCount})` : `${cat} (${matchCount})`}
                          </option>
                        );
                      })}
                    </select>
                    <div className="absolute left-2.5 top-1/2 -translate-y-1/2 pointer-events-none text-slate-400">
                      <Filter size={12} />
                    </div>
                    <div className="absolute right-2.5 top-1/2 -translate-y-1/2 pointer-events-none text-slate-400">
                      <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M19 9l-7 7-7-7" />
                      </svg>
                    </div>
                  </div>
                </div>

                {/* List of contact records */}
                <div className="flex-1 overflow-y-auto px-3.5 py-3 bg-slate-200">
                  {filteredContacts.length > 0 ? (
                    <div className="bg-white border border-slate-300 rounded-xl overflow-hidden divide-y divide-slate-150 shadow-xs">
                      {filteredContacts.map((contact) => (
                        <ContactCard
                          key={contact.id}
                          contact={contact}
                          onVote={handleVote}
                        />
                      ))}
                    </div>
                  ) : (
                    <div className="p-12 text-center text-slate-400 space-y-2 max-w-xs mx-auto mt-6">
                      <UserCheck size={28} className="mx-auto text-slate-300" />
                      <p className="text-xs font-bold text-slate-700">0 matches found</p>
                      <p className="text-[11px] text-slate-500 leading-relaxed font-sans">
                        No database records match the selected group filter or search keywords.
                      </p>
                    </div>
                  )}
                </div>

              </div>
            )}
          </div>
        )}

      </div>
    </PhoneFrame>
  );
}
