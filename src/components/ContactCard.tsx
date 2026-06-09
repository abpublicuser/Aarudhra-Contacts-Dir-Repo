import React, { useState } from 'react';
import { Copy, Check, FileText, Phone } from 'lucide-react';
import { Contact } from '../types';

interface ContactCardProps {
  contact: Contact;
  onVote: (contactId: string, voteType: 'up' | 'down') => void;
}

export const ContactCard: React.FC<ContactCardProps> = ({ contact, onVote }) => {
  const { name, phone, service, company, notes } = contact;
  const [copied, setCopied] = useState(false);

  const handleCopy = (e: React.MouseEvent) => {
    e.stopPropagation();
    const textToCopy = `${name}\nPhone: ${phone || 'N/A'}\nService: ${service || 'None'}${company ? `\nCompany: ${company}` : ''}${notes ? `\nNotes: ${notes}` : ''}`;
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
      className="w-full text-left bg-white p-3.5 space-y-2 relative group hover:bg-slate-50/85 transition-colors duration-150"
    >
      <div className="flex items-center justify-between gap-2.5">
        <div className="overflow-hidden flex-1">
          <h3 className="text-sm font-bold text-slate-800 group-hover:text-slate-950 transition-colors truncate leading-tight" title={displayName}>
            {displayName}
          </h3>
          <div className="flex items-center gap-1.5 mt-1 flex-wrap">
            <span className="text-[10px] font-extrabold tracking-wider uppercase bg-emerald-50 border border-emerald-100 text-emerald-700 px-2 py-0.5 rounded">
              {service}
            </span>
          </div>
        </div>

        {/* Action Row containing Thumbs Metrics before Copy button */}
        <div className="flex items-center gap-1.5 shrink-0">
          <button
            onClick={handleCopy}
            className="px-2 py-1.2 rounded-lg bg-slate-50 hover:bg-slate-100 border border-slate-200 text-slate-500 hover:text-slate-800 active:scale-95 transition-all cursor-pointer flex items-center gap-1 shrink-0"
            title="Copy Card Details"
            id={`btn-copy-${contact.id}`}
          >
            {copied ? (
              <>
                <Check size={11} className="text-emerald-600" />
                <span className="text-[9px] text-emerald-600 font-bold font-sans">Copied</span>
              </>
            ) : (
              <>
                <Copy size={11} />
                <span className="text-[9px] font-bold font-sans">Copy</span>
              </>
            )}
          </button>
        </div>
      </div>

      {/* Primary Communication details and notes in a clean, unified layout */}
      <div className="space-y-1 text-[12.5px] font-mono select-text pt-1">
        {phone ? (
          <a
            href={`tel:${phone}`}
            className="text-slate-600 hover:text-emerald-700 hover:underline flex items-center gap-2 transition-colors cursor-pointer"
            id={`phone-link-${contact.id}`}
          >
            <Phone size={12} className="text-slate-400 shrink-0" />
            <span className="truncate leading-none font-medium text-slate-700">{phone}</span>
          </a>
        ) : (
          <p className="text-slate-400 flex items-center gap-2 italic">
            <Phone size={12} className="text-slate-300 shrink-0" />
            <span className="leading-none text-slate-400">No phone provided</span>
          </p>
        )}

        {contact.raw?.["Recommended By"] && contact.raw["Recommended By"].trim() && (
          <div className="text-slate-500 text-[10.5px] font-sans flex items-center gap-1.5 select-text pt-0.5">
            <span className="font-extrabold text-slate-400 uppercase text-[8px] tracking-wider bg-slate-100 border border-slate-200 px-1 py-0.5 rounded leading-none">Rec</span>
            <span className="italic truncate" title={contact.raw["Recommended By"]}>
              Recommended by: <strong className="text-slate-650 font-semibold">{contact.raw["Recommended By"]}</strong>
            </span>
          </div>
        )}

        {notes && (
          <div className="text-slate-600 flex items-start gap-2 overflow-hidden pt-1 border-t border-dashed border-slate-100 mt-1">
            <FileText size={12} className="text-slate-400 shrink-0 mt-0.5" />
            <span className="leading-relaxed font-sans text-slate-500 select-text w-full break-words" title={notes}>
              {notes}
            </span>
          </div>
        )}
      </div>
    </div>
  );
};
