import { initializeApp, getApps, getApp } from "firebase/app";
import { getFirestore } from "firebase/firestore";
import { getStorage } from "firebase/storage";

/**
 * [CRITICAL] FIREBASE PERMISSION FIX:
 * 만약 "Missing or insufficient permissions" 에러가 발생한다면,
 * Firebase 콘솔에서 아래의 보안 규칙을 적용해야 합니다.
 * 
 * 1. Cloud Firestore -> Rules:
 *    rules_version = '2';
 *    service cloud.firestore {
 *      match /databases/{database}/documents {
 *        match /{document=**} {
 *          allow read, write: if true;
 *        }
 *      }
 *    }
 * 
 * 2. Storage -> Rules:
 *    rules_version = '2';
 *    service firebase.storage {
 *      match /b/{bucket}/o {
 *        match /{allPaths=**} {
 *          allow read, write: if true;
 *        }
 *      }
 *    }
 */

const firebaseConfig = {
  apiKey: "AIzaSyBs-UcKIwOSTxkizdkCJKmrXzP5dqWvZ44",
  authDomain: "prompt-archive-14df9.firebaseapp.com",
  projectId: "prompt-archive-14df9",
  storageBucket: "prompt-archive-14df9.firebasestorage.app",
  messagingSenderId: "1061181695966",
  appId: "1:1061181695966:web:999757777d8e7b8e97df4f"
};

const app = getApps().length === 0 ? initializeApp(firebaseConfig) : getApp();

export const db = getFirestore(app);
export const storage = getStorage(app);