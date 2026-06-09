import { Contact } from '../types';

/**
 * Standard RFC4180 CSV parser supporting column values with spaces, linebreaks, and escaped quotes.
 */
export function parseCSV(csvText: string): string[][] {
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

  // Remove trailing empty rows
  return result.filter(r => r.length > 0 && r.some(val => val.trim() !== ''));
}

/**
 * Extract Google Spreadsheet ID from a shared link or standard editor URL.
 */
export function extractSpreadsheetId(urlOrId: string): string | null {
  const trimmed = urlOrId.trim();
  const match = trimmed.match(/\/spreadsheets\/d\/([a-zA-Z0-9-_]+)/);
  if (match && match[1]) {
    return match[1];
  }
  // If it's a simple alphanumeric string, assume it's already the ID
  if (/^[a-zA-Z0-9-_]{12,}$/.test(trimmed)) {
    return trimmed;
  }
  return null;
}

/**
 * Loads contacts from a public Google Sheet (must be set as "Anyone with the link can view").
 * Uses the Gviz interface which has public CORS headers enabled.
 */
export async function fetchPublicSpreadsheetContacts(
  spreadsheetId: string,
  sheetName?: string
): Promise<Contact[]> {
  let url = `https://docs.google.com/spreadsheets/d/${spreadsheetId}/gviz/tq?tqx=out:csv`;
  if (sheetName) {
    url += `&sheet=${encodeURIComponent(sheetName)}`;
  }

  const response = await fetch(url);
  if (!response.ok) {
    throw new Error(
      `Unable to fetch sheet. Please verify that this sheet exists and the Access is set to "Anyone with the link can view".`
    );
  }

  const csvText = await response.text();
  const rows = parseCSV(csvText);

  if (rows.length === 0) {
    return [];
  }

  // Row 0 is the headers row
  const headers = rows[0].map((h) => (h || '').trim());
  const lowerHeaders = headers.map((h) => h.toLowerCase());

  // Search indices for common fields using fuzzy/regex matches
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
    
    // Name matching
    if (nameIdx === -1 && (h === 'name' || h === 'full name' || h === 'contact' || h === 'person' || h === 'contact name')) {
      nameIdx = i;
    } else if (firstNameIdx === -1 && (h.includes('first') || h.includes('given') || h === 'fn')) {
      firstNameIdx = i;
    } else if (lastNameIdx === -1 && (h.includes('last') || h.includes('surname') || h === 'ln')) {
      lastNameIdx = i;
    }

    // Phone matching
    if (phoneIdx === -1 && (h.includes('phone') || h.includes('mobile') || h.includes('tel') || h.includes('cell') || h === 'sms' || h.includes('contact number'))) {
      phoneIdx = i;
    }

    // Email matching
    if (emailIdx === -1 && (h.includes('email') || h.includes('e-mail') || h === 'mail' || h === 'email address')) {
      emailIdx = i;
    }

    // Service Type matching
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

    // Company matching
    if (companyIdx === -1 && (h.includes('company') || h.includes('firm') || h.includes('org') || h.includes('business') || h.includes('agency'))) {
      companyIdx = i;
    }

    // Notes matching
    if (notesIdx === -1 && (h.includes('note') || h.includes('comment') || h.includes('desc') || h.includes('memo') || h.includes('info') || h.includes('detail'))) {
      notesIdx = i;
    }

    // Thumbs metrics matching
    if (thumbsUpIdx === -1 && (h.includes('thumbs up') || h === 'likes' || h.includes('thumbsup') || h === 'votes')) {
      thumbsUpIdx = i;
    }
    if (thumbsDownIdx === -1 && (h.includes('thumbs down') || h === 'dislikes' || h.includes('thumbsdown'))) {
      thumbsDownIdx = i;
    }
  }

  const contacts: Contact[] = [];

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

    // Construct Name
    let currentName = '';
    if (nameIdx !== -1) {
      currentName = val(nameIdx);
    } else if (firstNameIdx !== -1 || lastNameIdx !== -1) {
      currentName = `${val(firstNameIdx)} ${val(lastNameIdx)}`.trim();
    }

    // Fallbacks if name is still empty
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
      id: `contact-${r}-${Math.random().toString(36).substr(2, 4)}`,
      name: currentName,
      phone: currentPhone,
      email: currentEmail,
      service: currentService || 'General',
      company: currentCompany,
      notes: currentNotes,
      thumbsUp: currentThumbsUp,
      thumbsDown: currentThumbsDown,
      rowIndex: r + 1, // Row 1 is headers, Row 2 is first details row
      raw: rawData,
    });
  }

  return contacts;
}

/**
 * Convert 0-based column index to spreadsheet column letter (e.g. 0 -> 'A', 25 -> 'Z', 26 -> 'AA')
 */
export function colIndexToLabel(index: number): string {
  let label = '';
  let temp = index;
  while (temp >= 0) {
    label = String.fromCharCode((temp % 26) + 65) + label;
    temp = Math.floor(temp / 26) - 1;
  }
  return label;
}

/**
 * Ensures "Thumbs Up" and "Thumbs Down" columns exist in the sheet.
 * If they do not, it appends them to Row 1 (the headers).
 * Returns the 0-based indices of the columns.
 */
export async function ensureVoteColumnsInSpreadsheet(
  accessToken: string,
  spreadsheetId: string,
  sheetTabName: string,
  headers: string[]
): Promise<{ thumbsUpIdx: number; thumbsDownIdx: number }> {
  const lowerHeaders = headers.map((h) => h.toLowerCase());
  let thumbsUpIdx = lowerHeaders.findIndex((h) => h.includes('thumbs up') || h === 'likes' || h === 'votes');
  let thumbsDownIdx = lowerHeaders.findIndex((h) => h.includes('thumbs down') || h === 'dislikes');

  // If both columns already exist, return their indices
  if (thumbsUpIdx !== -1 && thumbsDownIdx !== -1) {
    return { thumbsUpIdx, thumbsDownIdx };
  }

  // Determine starting index for appending
  const startColIdx = headers.length;
  let newThumbsUpIdx = thumbsUpIdx;
  let newThumbsDownIdx = thumbsDownIdx;

  const appendedHeaders: string[] = [];
  if (thumbsUpIdx === -1) {
    newThumbsUpIdx = startColIdx;
    appendedHeaders.push('Thumbs Up');
  }
  if (thumbsDownIdx === -1) {
    newThumbsDownIdx = thumbsUpIdx === -1 ? startColIdx + 1 : startColIdx;
    appendedHeaders.push('Thumbs Down');
  }

  try {
    const colLetterStart = colIndexToLabel(startColIdx);
    const colLetterEnd = colIndexToLabel(startColIdx + appendedHeaders.length - 1);
    
    // Explicitly fallback if tab name is empty
    const sanitizedTab = sheetTabName ? `${sheetTabName}!` : '';
    const range = `${sanitizedTab}${colLetterStart}1:${colLetterEnd}1`;

    const url = `https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}/values/${encodeURIComponent(range)}?valueInputOption=USER_ENTERED`;
    
    const response = await fetch(url, {
      method: 'PUT',
      headers: {
        'Authorization': `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        range,
        majorDimension: 'ROWS',
        values: [appendedHeaders],
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.warn('Auto-creating vote columns in spreadsheet failed:', errorText);
    } else {
      console.log('Successfully added vote columns to Google Spreadsheet:', appendedHeaders);
    }
  } catch (err) {
    console.error('Network error while creating vote columns in spreadsheet:', err);
  }

  return { 
    thumbsUpIdx: newThumbsUpIdx !== -1 ? newThumbsUpIdx : startColIdx, 
    thumbsDownIdx: newThumbsDownIdx !== -1 ? newThumbsDownIdx : startColIdx + 1 
  };
}

/**
 * Increment Google Spreadsheet column value for a certain contact card.
 */
export async function incrementSpreadsheetVote(
  accessToken: string,
  spreadsheetId: string,
  sheetTabName: string,
  rowIndex: number, // 2-indexed
  columnIdx: number, // 0-based column index
  newValue: number
): Promise<boolean> {
  const colLetter = colIndexToLabel(columnIdx);
  const sanitizedTab = sheetTabName ? `${sheetTabName}!` : '';
  const range = `${sanitizedTab}${colLetter}${rowIndex}`;

  const url = `https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}/values/${encodeURIComponent(range)}?valueInputOption=USER_ENTERED`;

  try {
    const response = await fetch(url, {
      method: 'PUT',
      headers: {
        'Authorization': `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        range,
        majorDimension: 'ROWS',
        values: [[newValue]],
      }),
    });

    return response.ok;
  } catch (err) {
    console.error(`Error updating spreadsheet cell ${colLetter}${rowIndex}:`, err);
    return false;
  }
}
