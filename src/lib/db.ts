import { getFirestore, doc, getDoc, setDoc, updateDoc, increment, collection, query, where, getDocs } from 'firebase/firestore';
import { app } from './auth';

const db = getFirestore(app);

export interface ContactVotes {
  thumbsUp: number;
  thumbsDown: number;
}

/**
 * Unique key combining spreadsheetId and contact identity (trimmed name and phone).
 */
export function getContactVoteKey(spreadsheetId: string, contactName: string, contactPhone: string): string {
  const sanitizedName = (contactName || '').trim().toLowerCase().replace(/[^a-z0-9]/g, '_');
  const sanitizedPhone = (contactPhone || '').trim().toLowerCase().replace(/[^a-z0-9]/g, '_');
  return `${spreadsheetId}_${sanitizedName}_${sanitizedPhone}`;
}

/**
 * Fetch a single contact's votes from Firestore.
 */
export async function fetchContactVotes(
  spreadsheetId: string,
  contactName: string,
  contactPhone: string
): Promise<ContactVotes> {
  try {
    const key = getContactVoteKey(spreadsheetId, contactName, contactPhone);
    const docRef = doc(db, 'contact_votes', key);
    const docSnap = await getDoc(docRef);
    if (docSnap.exists()) {
      const data = docSnap.data();
      return {
        thumbsUp: Number(data.thumbsUp || 0),
        thumbsDown: Number(data.thumbsDown || 0),
      };
    }
  } catch (err) {
    console.error('Error fetching votes from Firestore:', err);
  }
  return { thumbsUp: 0, thumbsDown: 0 };
}

/**
 * Fetch all contact votes associated with a specific spreadsheetId.
 */
export async function fetchAllSpreadsheetVotes(
  spreadsheetId: string
): Promise<Record<string, ContactVotes>> {
  const result: Record<string, ContactVotes> = {};
  try {
    const colRef = collection(db, 'contact_votes');
    const q = query(colRef, where('spreadsheetId', '==', spreadsheetId));
    const querySnapshot = await getDocs(q);
    querySnapshot.forEach((docSnap) => {
      const data = docSnap.data();
      // Document key format is spreadsheetId_sanitizedName_sanitizedPhone.
      // We will map by the document ID's suffix to identify contacts.
      result[docSnap.id] = {
        thumbsUp: Number(data.thumbsUp || 0),
        thumbsDown: Number(data.thumbsDown || 0),
      };
    });
  } catch (err) {
    console.error('Error fetching all spreadsheet votes from Firestore:', err);
  }
  return result;
}

/**
 * Record a vote (thumbs up or down) for a contact in Firestore.
 */
export async function recordVoteInFirestore(
  spreadsheetId: string,
  contactName: string,
  contactPhone: string,
  voteType: 'up' | 'down'
): Promise<ContactVotes> {
  const key = getContactVoteKey(spreadsheetId, contactName, contactPhone);
  const docRef = doc(db, 'contact_votes', key);

  try {
    const docSnap = await getDoc(docRef);
    if (!docSnap.exists()) {
      // Create with initial value
      const initialData = {
        spreadsheetId,
        contactName,
        contactPhone,
        thumbsUp: voteType === 'up' ? 1 : 0,
        thumbsDown: voteType === 'down' ? 1 : 0,
        updatedAt: new Date().toISOString(),
      };
      await setDoc(docRef, initialData);
      return {
        thumbsUp: initialData.thumbsUp,
        thumbsDown: initialData.thumbsDown,
      };
    } else {
      // Increment
      const updates: Record<string, any> = {
        updatedAt: new Date().toISOString(),
      };
      if (voteType === 'up') {
        updates.thumbsUp = increment(1);
      } else {
        updates.thumbsDown = increment(1);
      }
      await updateDoc(docRef, updates);
      
      // Return fresh values
      const freshSnap = await getDoc(docRef);
      const freshData = freshSnap.data() || {};
      return {
        thumbsUp: Number(freshData.thumbsUp || 0),
        thumbsDown: Number(freshData.thumbsDown || 0),
      };
    }
  } catch (err) {
    console.error('Failed to update vote in Firestore:', err);
    throw err;
  }
}
