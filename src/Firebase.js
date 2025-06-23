// Import the functions you need from the SDKs you need
import { initializeApp } from "firebase/app";
import { getAnalytics } from "firebase/analytics";
import { getFirestore } from "firebase/firestore";

const firebaseConfig = {
  apiKey: "AIzaSyC0y8TWIeYOc4Fvty10C3wapI5-PQ_HJ_o",

  authDomain: "my-whatsapp-34f74.firebaseapp.com",

  projectId: "my-whatsapp-34f74",

  storageBucket: "my-whatsapp-34f74.firebasestorage.app",

  messagingSenderId: "643234521544",

  appId: "1:643234521544:web:d7df51e63c7add59f5a0fd",

  measurementId: "G-PGC2LHLT86",
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);
const analytics = getAnalytics(app);

const db = getFirestore(app);

export { app, analytics, db };
