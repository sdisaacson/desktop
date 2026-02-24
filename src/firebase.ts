import { initializeApp } from "firebase/app";
import { getAuth, connectAuthEmulator } from "firebase/auth";
import { getFirestore, connectFirestoreEmulator } from "firebase/firestore";
import { getStorage, connectStorageEmulator } from "firebase/storage";

// Your web app's Firebase configuration
// For localhost/emulators, these values don't strictly matter but must be present.
const firebaseConfig = {
  apiKey: "AIzaSyDs3LpdleVp3R4wOA9p_wPrXTIzeaOQUJ4",
  authDomain: "kanso-new.firebaseapp.com",
  projectId: "kanso-new",
  storageBucket: "kanso-new.firebasestorage.app",
  messagingSenderId: "414698597464",
  appId: "1:414698597464:web:760f88f3b8af50a46e2e2d"
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);
const storage = getStorage(app);

// Connect to Emulators if in development
if (window.location.hostname === "localhost" || window.location.hostname === "127.0.0.1") {
    connectAuthEmulator(auth, "http://localhost:9099");
    connectFirestoreEmulator(db, "localhost", 8080);
    connectStorageEmulator(storage, "localhost", 9199);
    console.log("Connected to Firebase Emulators");
}

export { auth, db, storage };
