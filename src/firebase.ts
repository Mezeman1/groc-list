// Import the functions you need from the SDKs you need
import { initializeApp } from 'firebase/app'
import { getAnalytics } from 'firebase/analytics'
import { getAuth, GoogleAuthProvider } from 'firebase/auth'
import { getFirestore } from 'firebase/firestore'
// TODO: Add SDKs for Firebase products that you want to use
// https://firebase.google.com/docs/web/setup#available-libraries

// Your web app's Firebase configuration
// For Firebase JS SDK v7.20.0 and later, measurementId is optional
const firebaseConfig = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY,
  authDomain: 'groc-list-44eb6.firebaseapp.com',
  projectId: 'groc-list-44eb6',
  storageBucket: 'groc-list-44eb6.firebasestorage.app',
  messagingSenderId: '1006201837483',
  appId: '1:1006201837483:web:edc1c3e01109d36d36e4ee',
  measurementId: 'G-W9Q3X7PFQP',
}

// Initialize Firebase
const app = initializeApp(firebaseConfig)
const analytics = getAnalytics(app)

// Initialize Firebase Authentication
export const auth = getAuth(app)
export const googleProvider = new GoogleAuthProvider()

// Initialize Firestore
export const db = getFirestore(app)

// Export app instance if needed elsewhere
export default app
