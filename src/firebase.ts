/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 *
 * Frontend Firebase Authentication Configuration & Google Sign-In Helper
 *
 * Strictly reads VITE_FIREBASE_* runtime environment variables:
 *   - VITE_FIREBASE_API_KEY
 *   - VITE_FIREBASE_AUTH_DOMAIN
 *   - VITE_FIREBASE_PROJECT_ID
 *   - VITE_FIREBASE_STORAGE_BUCKET
 *   - VITE_FIREBASE_MESSAGING_SENDER_ID
 *   - VITE_FIREBASE_APP_ID
 */

import { initializeApp, getApps, getApp, FirebaseApp } from 'firebase/app';
import { getAuth, GoogleAuthProvider, signInWithPopup, signOut, Auth } from 'firebase/auth';

export interface FirebaseWebConfigStatus {
  configured: boolean;
  missingVars: string[];
  config: {
    apiKey: string;
    authDomain: string;
    projectId: string;
    storageBucket: string;
    messagingSenderId: string;
    appId: string;
  };
}

export const REQUIRED_FIREBASE_ENV_VARS = [
  'VITE_FIREBASE_API_KEY',
  'VITE_FIREBASE_AUTH_DOMAIN',
  'VITE_FIREBASE_PROJECT_ID',
  'VITE_FIREBASE_STORAGE_BUCKET',
  'VITE_FIREBASE_MESSAGING_SENDER_ID',
  'VITE_FIREBASE_APP_ID'
] as const;

/**
 * Resolves Firebase Web SDK configuration strictly from VITE_FIREBASE_* environment variables.
 */
export function getFirebaseWebConfigStatus(
  envOverride?: Record<string, string | undefined>
): FirebaseWebConfigStatus {
  const metaEnv: Record<string, string | undefined> =
    typeof import.meta !== 'undefined' && (import.meta as any).env
      ? ((import.meta as any).env as Record<string, string | undefined>)
      : {};

  const nodeEnv: Record<string, string | undefined> =
    typeof process !== 'undefined' && process.env
      ? (process.env as Record<string, string | undefined>)
      : {};

  const sourceEnv = envOverride ?? { ...nodeEnv, ...metaEnv };

  const apiKey = (sourceEnv.VITE_FIREBASE_API_KEY || '').trim();
  const authDomain = (sourceEnv.VITE_FIREBASE_AUTH_DOMAIN || '').trim();
  const projectId = (sourceEnv.VITE_FIREBASE_PROJECT_ID || '').trim();
  const storageBucket = (sourceEnv.VITE_FIREBASE_STORAGE_BUCKET || '').trim();
  const messagingSenderId = (sourceEnv.VITE_FIREBASE_MESSAGING_SENDER_ID || '').trim();
  const appId = (sourceEnv.VITE_FIREBASE_APP_ID || '').trim();

  const missingVars: string[] = [];
  if (!apiKey) missingVars.push('VITE_FIREBASE_API_KEY');
  if (!authDomain) missingVars.push('VITE_FIREBASE_AUTH_DOMAIN');
  if (!projectId) missingVars.push('VITE_FIREBASE_PROJECT_ID');
  if (!storageBucket) missingVars.push('VITE_FIREBASE_STORAGE_BUCKET');
  if (!messagingSenderId) missingVars.push('VITE_FIREBASE_MESSAGING_SENDER_ID');
  if (!appId) missingVars.push('VITE_FIREBASE_APP_ID');

  return {
    configured: missingVars.length === 0,
    missingVars,
    config: {
      apiKey,
      authDomain,
      projectId,
      storageBucket,
      messagingSenderId,
      appId
    }
  };
}

let firebaseAppInstance: FirebaseApp | null = null;
let firebaseAuthInstance: Auth | null = null;

export function getFirebaseAuth(): Auth {
  const status = getFirebaseWebConfigStatus();
  if (!status.configured) {
    throw new Error(
      `Firebase Authentication is not configured. Missing required environment variables: ${status.missingVars.join(', ')}.`
    );
  }

  if (!firebaseAppInstance) {
    firebaseAppInstance = getApps().length > 0 ? getApp() : initializeApp(status.config);
  }
  if (!firebaseAuthInstance) {
    firebaseAuthInstance = getAuth(firebaseAppInstance);
  }
  return firebaseAuthInstance;
}

export const googleAuthProvider = new GoogleAuthProvider();
googleAuthProvider.addScope('email');
googleAuthProvider.addScope('profile');
googleAuthProvider.setCustomParameters({
  prompt: 'select_account'
});

/**
 * Authenticates the user with Google using Firebase Authentication signInWithPopup()
 * and returns the verified Firebase ID token via user.getIdToken().
 */
export async function signInWithFirebaseGoogle(): Promise<{ idToken: string }> {
  const auth = getFirebaseAuth();
  const userCredential = await signInWithPopup(auth, googleAuthProvider);
  if (!userCredential || !userCredential.user) {
    throw new Error('Firebase Google authentication failed to return a user credential.');
  }

  const idToken = await userCredential.user.getIdToken(true);

  try {
    await signOut(auth);
  } catch {
    // Ignore client signOut cleanup errors
  }

  return { idToken };
}

export function getFirebaseApp(): FirebaseApp {
  const status = getFirebaseWebConfigStatus();
  if (!firebaseAppInstance) {
    firebaseAppInstance = getApps().length > 0 ? getApp() : initializeApp(status.config);
  }
  return firebaseAppInstance;
}

