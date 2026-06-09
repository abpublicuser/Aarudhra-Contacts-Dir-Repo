export interface Contact {
  id: string;
  name: string;
  phone: string;
  email: string;
  service: string;
  company: string;
  notes: string;
  thumbsUp: number;
  thumbsDown: number;
  rowIndex: number;
  raw: Record<string, string>; // All column-value pairs including unmapped columns
}

export interface SpreadsheetFile {
  id: string;
  name: string;
  modifiedTime: string;
}

export interface SheetTab {
  title: string;
}

export interface AppState {
  user: any | null;
  accessToken: string | null;
  selectedSpreadsheet: SpreadsheetFile | null;
  selectedTab: string | null;
  contacts: Contact[];
  categories: string[];
  isLoading: boolean;
  error: string | null;
}
