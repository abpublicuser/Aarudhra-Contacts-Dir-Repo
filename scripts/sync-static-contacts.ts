import fs from 'fs';
import path from 'path';

/**
 * Standard RFC4180 CSV parser supporting column values with spaces, linebreaks, and escaped quotes.
 */
function parseCSV(csvText: string): string[][] {
  const result: string[][] = [];
  let row: string[] = [];
  let cell = '';
  let insideQuote = false;

  for (let i = 0; i < csvText.length; i++) {
    const char = csvText[i];
    const nextChar = csvText[i + 1];

    if (char === '"') {
      if (insideQuote && nextChar === '"') {
        cell += '"';
        i++; // Skip the escaped quote
      } else {
        insideQuote = !insideQuote;
      }
    } else if (char === ',' && !insideQuote) {
      row.push(cell);
      cell = '';
    } else if ((char === '\r' || char === '\n') && !insideQuote) {
      if (char === '\r' && nextChar === '\n') {
        i++;
      }
      row.push(cell);
      result.push(row);
      row = [];
      cell = '';
    } else {
      cell += char;
    }
  }

  if (cell || row.length > 0) {
    row.push(cell);
    result.push(row);
  }

  return result.filter(r => r.length > 0 && r.some(val => val.trim() !== ''));
}

async function main() {
  const SPREADSHEET_ID = "1dN6bkj48B126yAQ4mDZbchr27qOmC52dmH4TFRwUrPU";
  const url = `https://docs.google.com/spreadsheets/d/${SPREADSHEET_ID}/gviz/tq?tqx=out:csv`;

  console.log(`Fetching from Google Sheet: ${url}`);
  const res = await fetch(url);
  if (!res.ok) {
    throw new Error(`Failed to fetch spreadsheet: ${res.statusText}`);
  }

  const csvText = await res.text();
  const rows = parseCSV(csvText);
  if (rows.length === 0) {
    throw new Error("No rows found in the CSV");
  }

  const headers = rows[0].map(h => (h || '').trim());
  const lowerHeaders = headers.map(h => h.toLowerCase());

  console.log('Detected CSV Headers:', headers);

  // Column matching
  let nameIdx = -1;
  let firstNameIdx = -1;
  let lastNameIdx = -1;
  let phoneIdx = -1;
  let emailIdx = -1;
  let serviceIdx = -1;
  let companyIdx = -1;
  let notesIdx = -1;
  let thumbsUpIdx = -1;
  let thumbsDownIdx = -1;

  for (let i = 0; i < lowerHeaders.length; i++) {
    const h = lowerHeaders[i];
    if (nameIdx === -1 && (h === 'name' || h === 'full name' || h === 'contact' || h === 'person' || h === 'contact name')) {
      nameIdx = i;
    } else if (firstNameIdx === -1 && (h.includes('first') || h.includes('given') || h === 'fn')) {
      firstNameIdx = i;
    } else if (lastNameIdx === -1 && (h.includes('last') || h.includes('surname') || h === 'ln')) {
      lastNameIdx = i;
    }

    if (phoneIdx === -1 && (h.includes('phone') || h.includes('mobile') || h.includes('tel') || h.includes('cell') || h === 'sms' || h.includes('contact number'))) {
      phoneIdx = i;
    }

    if (emailIdx === -1 && (h.includes('email') || h.includes('e-mail') || h === 'mail' || h === 'email address')) {
      emailIdx = i;
    }

    if (serviceIdx === -1 && (
      h.includes('service') || 
      h.includes('category') || 
      h.includes('job') || 
      h.includes('role') || 
      h.includes('specialty') || 
      h.includes('trade') || 
      h.includes('work') || 
      h.includes('title') || 
      h === 'type' || 
      h === 'group'
    )) {
      serviceIdx = i;
    }

    if (companyIdx === -1 && (h.includes('company') || h.includes('firm') || h.includes('org') || h.includes('business') || h.includes('agency'))) {
      companyIdx = i;
    }

    if (notesIdx === -1 && (h.includes('note') || h.includes('comment') || h.includes('desc') || h.includes('memo') || h.includes('info') || h.includes('detail'))) {
      notesIdx = i;
    }

    if (thumbsUpIdx === -1 && (h.includes('thumbs up') || h === 'likes' || h.includes('thumbsup') || h === 'votes')) {
      thumbsUpIdx = i;
    }
    if (thumbsDownIdx === -1 && (h.includes('thumbs down') || h === 'dislikes' || h.includes('thumbsdown'))) {
      thumbsDownIdx = i;
    }
  }

  const contacts = [];

  for (let r = 1; r < rows.length; r++) {
    const row = rows[r];
    if (row.length === 0) continue;

    const isEmptyData = row.every((val) => !val || val.trim() === '');
    if (isEmptyData) continue;

    const val = (idx: number) => {
      if (idx >= 0 && idx < row.length) {
        return (row[idx] || '').trim();
      }
      return '';
    };

    let currentName = '';
    if (nameIdx !== -1) {
      currentName = val(nameIdx);
    } else if (firstNameIdx !== -1 || lastNameIdx !== -1) {
      currentName = `${val(firstNameIdx)} ${val(lastNameIdx)}`.trim();
    }

    if (!currentName) {
      if (companyIdx !== -1 && val(companyIdx)) {
        currentName = '';
      } else if (emailIdx !== -1 && val(emailIdx)) {
        currentName = val(emailIdx).split('@')[0];
      } else if (phoneIdx !== -1 && val(phoneIdx)) {
        currentName = `Contact (${val(phoneIdx)})`;
      } else {
        currentName = `Contact #${r}`;
      }
    }

    const currentPhone = phoneIdx !== -1 ? val(phoneIdx) : '';
    const currentEmail = emailIdx !== -1 ? val(emailIdx) : '';
    const currentService = serviceIdx !== -1 ? val(serviceIdx) : 'Uncategorized';
    const currentCompany = companyIdx !== -1 ? val(companyIdx) : '';
    const currentNotes = notesIdx !== -1 ? val(notesIdx) : '';
    const currentThumbsUp = thumbsUpIdx !== -1 ? (parseInt(val(thumbsUpIdx), 10) || 0) : 0;
    const currentThumbsDown = thumbsDownIdx !== -1 ? (parseInt(val(thumbsDownIdx), 10) || 0) : 0;

    const rawData: Record<string, string> = {};
    headers.forEach((h, colIdx) => {
      rawData[h] = val(colIdx);
    });

    contacts.push({
      id: `contact-${r}`,
      name: currentName,
      phone: currentPhone,
      email: currentEmail,
      service: currentService || 'General',
      company: currentCompany,
      notes: currentNotes,
      thumbsUp: currentThumbsUp,
      thumbsDown: currentThumbsDown,
      rowIndex: r + 1,
      raw: rawData,
    });
  }

  console.log(`Parsed ${contacts.length} contacts.`);

  const outputPath = path.join(process.cwd(), 'src', 'data', 'contacts.ts');
  const fileContent = `import { Contact } from '../types';

/**
 * 📇 LOCAL CONTACTS DATABASE
 * 
 * Auto-synced from Google Spreadsheet URL:
 * https://docs.google.com/spreadsheets/d/${SPREADSHEET_ID}/edit
 * 
 * To edit contacts easily, modify this file or update Google Sheet and re-sync.
 */
export const STATIC_CONTACTS: Contact[] = ${JSON.stringify(contacts, null, 2)};
`;

  fs.writeFileSync(outputPath, fileContent, 'utf-8');
  console.log(`Successfully wrote to ${outputPath}`);
}

main().catch(console.error);
