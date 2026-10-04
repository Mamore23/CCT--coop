/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 *
 * Backend Firebase Admin SDK Verification Service
 *
 * Verifies Firebase Authentication ID tokens server-side using firebase-admin
 * configured strictly from VITE_FIREBASE_* runtime environment variables.
 * Never trusts browser-supplied email, role, memberId, or userId fields.
 * Never logs or persists Firebase ID tokens or private keys.
 */

import jwt from 'jsonwebtoken';
import { initializeApp, getApps, App as AdminApp } from 'firebase-admin/app';
import { getAuth as getAdminAuth, DecodedIdToken } from 'firebase-admin/auth';

export interface VerifiedFirebaseTokenClaims {
  uid: string;
  email: string;
  email_verified: boolean;
  name?: string;
  picture?: string;
  signInProvider?: string;
}

export interface FirebaseVerificationResult {
  valid: boolean;
  claims?: VerifiedFirebaseTokenClaims;
  error?: string;
}

export function getFirebaseServerConfigStatus(env: NodeJS.ProcessEnv = process.env): {
  configured: boolean;
  projectId: string;
  missingVars: string[];
} {
  const apiKey = (env.VITE_FIREBASE_API_KEY || '').trim();
  const authDomain = (env.VITE_FIREBASE_AUTH_DOMAIN || '').trim();
  const projectId = (env.VITE_FIREBASE_PROJECT_ID || '').trim();
  const storageBucket = (env.VITE_FIREBASE_STORAGE_BUCKET || '').trim();
  const messagingSenderId = (env.VITE_FIREBASE_MESSAGING_SENDER_ID || '').trim();
  const appId = (env.VITE_FIREBASE_APP_ID || '').trim();

  const missingVars: string[] = [];
  if (!apiKey) missingVars.push('VITE_FIREBASE_API_KEY');
  if (!authDomain) missingVars.push('VITE_FIREBASE_AUTH_DOMAIN');
  if (!projectId) missingVars.push('VITE_FIREBASE_PROJECT_ID');
  if (!storageBucket) missingVars.push('VITE_FIREBASE_STORAGE_BUCKET');
  if (!messagingSenderId) missingVars.push('VITE_FIREBASE_MESSAGING_SENDER_ID');
  if (!appId) missingVars.push('VITE_FIREBASE_APP_ID');

  return {
    configured: missingVars.length === 0,
    projectId,
    missingVars
  };
}

const adminAppsByProject = new Map<string, AdminApp>();

export function getFirebaseAdminApp(): AdminApp {
  const { configured, projectId, missingVars } = getFirebaseServerConfigStatus();
  if (!configured || !projectId) {
    throw new Error(
      `Firebase Admin SDK is not configured. Missing required environment variables: ${missingVars.join(', ')}.`
    );
  }

  const cached = adminAppsByProject.get(projectId);
  if (cached) return cached;

  const appName = `coop-firebase-admin-${projectId}`;
  const existing = getApps().find(a => a.name === appName);
  const app = existing || initializeApp({ projectId }, appName);
  adminAppsByProject.set(projectId, app);
  return app;
}

const FIREBASE_TEST_SIGNING_KEY =
  (process.env.JWT_SECRET || 'cooperative-jwt-super-secret-key-123') + '::firebase-admin-test-verifier';

/**
 * Helper used strictly by automated verification suites in non-production environments
 * to mint cryptographically signed test Firebase ID tokens for the configured VITE_FIREBASE_PROJECT_ID.
 */
export function createTestFirebaseIdToken(
  payload: {
    uid: string;
    email: string;
    email_verified?: boolean;
    name?: string;
    picture?: string;
    signInProvider?: string;
  },
  options?: {
    expiresInSeconds?: number;
    secretOverride?: string;
  }
): string {
  const { projectId } = getFirebaseServerConfigStatus();
  const resolvedProjectId = projectId || 'cctcooperative-f558e';
  const expiresIn = options?.expiresInSeconds ?? 3600;
  const signingSecret = options?.secretOverride ?? FIREBASE_TEST_SIGNING_KEY;

  return jwt.sign(
    {
      uid: payload.uid,
      sub: payload.uid,
      email: payload.email,
      email_verified: payload.email_verified !== undefined ? payload.email_verified : true,
      name: payload.name || 'Cooperative Member',
      picture: payload.picture || '',
      firebase: {
        sign_in_provider: payload.signInProvider || 'google.com'
      }
    },
    signingSecret,
    {
      algorithm: 'HS256',
      issuer: `https://securetoken.google.com/${resolvedProjectId}`,
      audience: resolvedProjectId,
      expiresIn
    }
  );
}

/**
 * Verifies a Firebase ID token server-side using the Firebase Admin SDK.
 * Never logs or exposes the raw ID token.
 */
export async function verifyFirebaseIdToken(idToken: string): Promise<FirebaseVerificationResult> {
  if (typeof idToken !== 'string' || !idToken.trim()) {
    return {
      valid: false,
      error: 'Missing Firebase ID token.'
    };
  }

  const trimmedToken = idToken.trim();
  const parts = trimmedToken.split('.');
  if (parts.length !== 3 || !parts[0] || !parts[1] || !parts[2]) {
    return {
      valid: false,
      error: 'Invalid or malformed Firebase ID token.'
    };
  }

  const configStatus = getFirebaseServerConfigStatus();
  if (!configStatus.configured || !configStatus.projectId) {
    return {
      valid: false,
      error: `Firebase Authentication is not configured. Missing required environment variables: ${configStatus.missingVars.join(', ')}.`
    };
  }

  // In non-production automated test suites, support HS256 test tokens signed with FIREBASE_TEST_SIGNING_KEY
  if (process.env.NODE_ENV !== 'production') {
    try {
      const headerJson = JSON.parse(Buffer.from(parts[0], 'base64url').toString('utf-8'));
      if (headerJson && headerJson.alg === 'HS256') {
        const decodedTest = jwt.verify(trimmedToken, FIREBASE_TEST_SIGNING_KEY, {
          algorithms: ['HS256'],
          issuer: `https://securetoken.google.com/${configStatus.projectId}`,
          audience: configStatus.projectId
        }) as any;

        const uid = typeof decodedTest?.uid === 'string' ? decodedTest.uid.trim() : (typeof decodedTest?.sub === 'string' ? decodedTest.sub.trim() : '');
        const email = typeof decodedTest?.email === 'string' ? decodedTest.email.trim().toLowerCase() : '';
        if (!uid || !email) {
          return {
            valid: false,
            error: 'Firebase ID token is missing required uid or email claims.'
          };
        }

        return {
          valid: true,
          claims: {
            uid,
            email,
            email_verified: Boolean(decodedTest.email_verified),
            name: typeof decodedTest.name === 'string' ? decodedTest.name : undefined,
            picture: typeof decodedTest.picture === 'string' ? decodedTest.picture : undefined,
            signInProvider: decodedTest?.firebase?.sign_in_provider || 'google.com'
          }
        };
      }
    } catch {
      return {
        valid: false,
        error: 'Invalid, expired, or tampered Firebase ID token.'
      };
    }
  }

  // Production / real Firebase Auth RS256 ID token verification via Firebase Admin SDK
  try {
    const app = getFirebaseAdminApp();
    const adminAuth = getAdminAuth(app);
    const decoded: DecodedIdToken = await adminAuth.verifyIdToken(trimmedToken);

    const uid = (decoded.uid || decoded.sub || '').trim();
    const email = (decoded.email || '').trim().toLowerCase();

    if (!uid || !email) {
      return {
        valid: false,
        error: 'Verified Firebase ID token does not contain a valid uid and email.'
      };
    }

    return {
      valid: true,
      claims: {
        uid,
        email,
        email_verified: Boolean(decoded.email_verified),
        name: typeof decoded.name === 'string' ? decoded.name : undefined,
        picture: typeof decoded.picture === 'string' ? decoded.picture : undefined,
        signInProvider: decoded.firebase?.sign_in_provider || 'google.com'
      }
    };
  } catch {
    return {
      valid: false,
      error: 'Invalid, expired, or tampered Firebase ID token.'
    };
  }
}
