import { useState, useEffect } from 'react';
import { 
  Search, Database, UserCheck, Filter
} from 'lucide-react';
import { fetchAllSpreadsheetVotes, recordVoteInFirestore } from './lib/db';
import { Contact } from './types';
import { PhoneFrame } from './components/PhoneFrame';
import { ContactCard } from './components/ContactCard';
import { STATIC_CONTACTS } from './data/contacts';

export default function App() {
  // Feed contacts directly from the local static database file
  const [contacts, setContacts] = useState<Contact[]>(STATIC_CONTACTS);
  const [isLoadingVotes, setIsLoadingVotes] = useState(false);

  // Live filter state
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('All');

  // Load and overlay any votes from Firestore to provide real-time rating persistence (if votes are enabled)
  useEffect(() => {
    const syncFirestoreVotes = async () => {
      setIsLoadingVotes(true);
      try {
        const firestoreVotes = await fetchAllSpreadsheetVotes("static_directory");
        setContacts((prev) =>
          prev.map((contact) => {
            const voteKey = `static_directory_${(contact.name || '').trim().toLowerCase().replace(/[^a-z0-9]/g, '_')}_${(contact.phone || '').trim().toLowerCase().replace(/[^a-z0-9]/g, '_')}`;
            const fVotes = firestoreVotes[voteKey];
            if (fVotes) {
              return {
                ...contact,
                thumbsUp: Math.max(contact.thumbsUp || 0, fVotes.thumbsUp || 0),
                thumbsDown: Math.max(contact.thumbsDown || 0, fVotes.thumbsDown || 0)
              };
            }
            return contact;
          })
        );
      } catch (err) {
        console.warn('Could not sync Firestore votes:', err);
      } finally {
        setIsLoadingVotes(false);
      }
    };

    syncFirestoreVotes();
  }, []);

  // Handle vote triggers (can be wired back if buttons are uncommented in card view)
  const handleVote = async (contactId: string, voteType: 'up' | 'down') => {
    const targetContact = contacts.find((c) => c.id === contactId);
    if (!targetContact) return;

    // Optimistically update React state immediately for snappy response
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
      const freshVotes = await recordVoteInFirestore(
        "static_directory",
        targetContact.name,
        targetContact.phone,
        voteType
      );

      // Re-align counts with output from Firestore database
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
    } catch (err) {
      console.error('Failure saving vote metrics:', err);
    }
  };

  // Extract unique custom Categories (Type of Service) dynamically
  const uniqueServices = Array.from(new Set(contacts.map((c) => c.service)))
    .filter((s): s is string => !!s)
    .sort((a, b) => a.localeCompare(b));
  const categories = ['All', ...uniqueServices];

  // Filter contacts locally dynamically
  const filteredContacts = contacts.filter((c) => {
    const matchesSearch = 
      c.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      c.phone.toLowerCase().includes(searchQuery.toLowerCase()) ||
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
        <div className="bg-slate-50 border-b border-slate-300 py-2.5 px-3.5 shrink-0 flex items-center justify-between gap-2 shadow-sm">
          <div className="flex items-center gap-2 overflow-hidden">
            <Database size={16} className="text-emerald-650 shrink-0" />
            <div className="overflow-hidden">
              <h1 className="text-xs font-bold text-slate-900 tracking-tight truncate">
                Service Contacts
              </h1>
              <p className="text-[9px] text-emerald-650 font-semibold font-mono uppercase tracking-wide">
                {isLoadingVotes ? 'Updating Ratings...' : 'Local Service Directory'}
              </p>
            </div>
          </div>
        </div>

        {/* Catalog viewer */}
        <div className="flex-1 flex flex-col overflow-hidden relative bg-slate-200">
          <div className="flex-1 flex flex-col overflow-hidden">
            
            {/* Search filters and Category selection */}
            <div className="py-2.5 px-3.5 bg-slate-50 border-b border-slate-300 shrink-0 space-y-2 shadow-2xs z-10 mb-0.5">
              
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
                    No directory records match the selected group filter or search keywords.
                  </p>
                </div>
              )}
            </div>

          </div>
        </div>

      </div>
    </PhoneFrame>
  );
}
