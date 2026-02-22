import { initializeApp } from 'firebase/app';
import { getAuth } from 'firebase/auth';
import {
  getFirestore,
  initializeFirestore,
  persistentLocalCache,
  persistentMultipleTabManager,
} from 'firebase/firestore';
import { getFunctions } from 'firebase/functions';
import { getStorage } from 'firebase/storage';

// --- FIREBASE CONFIG ---
const firebaseConfig = {
  apiKey: "AIzaSyAoVj92dmnl5gBB7zYul0iG2Ekp5cbmkp0",
  authDomain: "hostella-app-a1e07.firebaseapp.com",
  projectId: "hostella-app-a1e07",
  storageBucket: "hostella-app-a1e07.firebasestorage.app",
  messagingSenderId: "826787873496",
  appId: "1:826787873496:web:51a0c6e42631a28919cdad"
};

export const app = initializeApp(firebaseConfig);
export const auth = getAuth(app);
export const functions = getFunctions(app);

// Protection against re-initialization
let db;
try {
  db = initializeFirestore(app, {
    localCache: persistentLocalCache({
      tabManager: persistentMultipleTabManager()
    })
  }, "hostella");
} catch (error) {
  console.log('Firestore already initialized, using existing instance');
  db = getFirestore(app);
}

export { db };

export const storage = getStorage(app);

export const APP_ID = 'hostella-multi-v4';
export const PUBLIC_DATA_PATH = ['artifacts', APP_ID, 'public', 'data'];
