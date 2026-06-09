import React, { useState } from 'react';
import { Copy, Check, FileText, Phone, Mail, ThumbsUp, ThumbsDown } from 'lucide-react';
import { Contact } from '../types';

interface ContactCardProps {
  contact: Contact;
  onVote: (contactId: string, voteType: 'up' | 'down') => void;
}

// Generate an elegant, consistent background pastel color and text color based on the contact name/service
export const getAvatarColor = (str: string) => {
  const hash = Array.from(str || '').reduce((acc, char) => acc + char.charCodeAt(0), 0);
  const presets = [
    { bg: 'bg-emerald-500/10 border-emerald-500/20 text-emerald-400' },
    { bg: 'bg-sky-500/10 border-sky-500/20 text-sky-400' },
    { bg: 'bg-violet-500/10 border-violet-500/20 text-violet-400' },
    { bg: 'bg-amber-500/10 border-amber-500/20 text-amber-400' },
    { bg: 'bg-rose-500/10 border-rose-500/20 text-rose-400' },
    { bg: 'bg-indigo-500/10 border-indigo-500/20 text-indigo-400' },
    { bg: 'bg-teal-500/10 border-teal-500/20 text-teal-400' },
    { bg: 'bg-cyan-500/10 border-cyan-500/20 text-cyan-400' },
    { bg: 'bg-fuchsia-500/10 border-fuchsia-500/20 text-fuchsia-400' },
  ];
  return presets[hash % presets.length];
};

export const ContactCard: React.FC<ContactCardProps> = ({ contact, onVote }) => {
  const { name, phone, email, service, company, notes } = contact;
  const colorPreset = getAvatarColor(service || name);
  const [copied, setCopied] = useState(false);

  const handleCopy = (e: React.MouseEvent) => {
    e.stopPropagation();
    const textToCopy = `${name}\nPhone: ${phone || 'N/A'}\nEmail: ${email || 'N/A'}\nService: ${service || 'None'}${company ? `\nCompany: ${company}` : ''}${notes ? `\nNotes: ${notes}` : ''}`;
    navigator.clipboard.writeText(textToCopy);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const displayName = name && company
    ? `${name} - ${company}`
    : name
      ? name
      : company
        ? company
        : 'Unnamed Contact';

  return (
    <div
      id={`card-${contact.id}`}
      className="w-full text-left bg-white p-2.5 space-y-1.5 relative group hover:bg-slate-50/85 transition-colors duration-150"
    >
      <div className="flex items-center justify-between gap-2.5">
        <div className="flex items-center gap-2 overflow-hidden flex-1">
          <div className="overflow-hidden">
            <h3 className="text-base font-bold text-slate-800 group-hover:text-slate-950 transition-colors truncate leading-tight" title={displayName}>
              {displayName}
            </h3>
            <div className="flex items-center gap-1.5 mt-0.5 flex-wrap">
              <span className="text-[10px] font-extrabold tracking-wider uppercase bg-emerald-50 border border-emerald-100 text-emerald-700 px-2 py-0.5 rounded">
                {service}
              </span>
            </div>
          </div>
        </div>

        {/* Action Row containing Thumbs Metrics before Copy button */}
        <div className="flex items-center gap-1.5 shrink-0">
          {/* Voting buttons temporarily hidden:
          <button
            onClick={(e) => {
              e.stopPropagation();
              onVote(contact.id, 'up');
            }}
            className="px-2 py-1.5 rounded-lg bg-slate-50 border border-slate-200/80 hover:bg-emerald-50 hover:text-emerald-700 text-slate-500 hover:border-emerald-205 active:scale-95 transition-all text-[11px] font-bold font-mono tracking-tight cursor-pointer flex items-center gap-1.5"
            title="Thumb Up (Like)"
            id={`btn-like-${contact.id}`}
          >
            <ThumbsUp size={11} />
            <span>{contact.thumbsUp || 0}</span>
          </button>

          <button
            onClick={(e) => {
              e.stopPropagation();
              onVote(contact.id, 'down');
            }}
            className="px-2 py-1.5 rounded-lg bg-slate-50 border border-slate-200/80 hover:bg-rose-50 hover:text-rose-700 text-slate-500 hover:border-rose-205 active:scale-95 transition-all text-[11px] font-bold font-mono tracking-tight cursor-pointer flex items-center gap-1.5"
            title="Thumb Down (Dislike)"
            id={`btn-dislike-${contact.id}`}
          >
            <ThumbsDown size={11} />
            <span>{contact.thumbsDown || 0}</span>
          </button>
          */}

          <button
            onClick={handleCopy}
            className="px-2 py-1.5 rounded-lg bg-slate-50 hover:bg-slate-100 border border-slate-200 text-slate-500 hover:text-slate-800 active:scale-95 transition-all cursor-pointer flex items-center gap-1.5 shrink-0"
            title="Copy Card Details"
            id={`btn-copy-${contact.id}`}
          >
            {copied ? (
              <>
                <Check size={11.5} className="text-emerald-600" />
                <span className="text-[10px] text-emerald-600 font-bold font-sans">Copied</span>
              </>
            ) : (
              <>
                <Copy size={11.5} />
                <span className="text-[10px] font-bold font-sans">Copy</span>
              </>
            )}
          </button>
        </div>
      </div>

      {/* Primary Communication details and notes in a clean, unified layout */}
      <div className="space-y-1.5 text-[13px] font-mono select-text pt-1">
        {phone ? (
          <a
            href={`tel:${phone}`}
            className="text-slate-600 hover:text-emerald-700 hover:underline flex items-center gap-2 transition-colors cursor-pointer"
            id={`phone-link-${contact.id}`}
          >
            <Phone size={13} className="text-slate-400 shrink-0" />
            <span className="truncate leading-none font-medium">{phone}</span>
          </a>
        ) : (
          <p className="text-slate-400 flex items-center gap-2 italic">
            <Phone size={13} className="text-slate-300 shrink-0" />
            <span className="leading-none">No phone provided</span>
          </p>
        )}
        {notes && (
          <div className="text-slate-600 flex items-start gap-2 overflow-hidden pt-0.5">
            <FileText size={13} className="text-slate-400 shrink-0 mt-0.5" />
            <span className="leading-snug font-sans text-slate-500 select-text w-full break-words" title={notes}>
              {notes}
            </span>
          </div>
        )}
      </div>
    </div>
  );
};
