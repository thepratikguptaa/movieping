import { initializeApp, getApps, getApp, type FirebaseApp } from "firebase/app";
import { getAuth, type Auth } from "firebase/auth";
import {
  initializeFirestore,
  getFirestore,
  type Firestore,
} from "firebase/firestore";

const firebaseConfig = {
  apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY,
  authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN,
  projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
  storageBucket: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID,
  appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID,
};

export const firebaseApp: FirebaseApp = getApps().length
  ? getApp()
  : initializeApp(firebaseConfig);

export const auth: Auth = getAuth(firebaseApp);

// Auto-detect long-polling so Firestore still connects behind VPNs, proxies,
// strict tracking protection, and networks that block its streaming channel.
// initializeFirestore can only run once per app; fall back to getFirestore on
// hot-reload when it's already been initialized.
function buildFirestore(): Firestore {
  try {
    return initializeFirestore(firebaseApp, {
      // Force long-polling outright: the streaming WebChannel is what a VPN
      // (WARP), proxy, or tracking protection blocks, producing the
      // "client is offline" error. Long-polling uses ordinary HTTPS requests.
      experimentalForceLongPolling: true,
    });
  } catch {
    return getFirestore(firebaseApp);
  }
}

export const db: Firestore = buildFirestore();
