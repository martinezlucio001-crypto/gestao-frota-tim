// Configuração centralizada do Firebase
import { initializeApp } from 'firebase/app';
import { getAuth } from 'firebase/auth';
import { getFirestore } from 'firebase/firestore';
import { getStorage } from 'firebase/storage';

const firebaseConfig = {
    apiKey: "AIzaSyA3VhT2iHrD1uzOFI9Bc_BYyMoCpOG-G8w",
    authDomain: "gestao-frota-tim.firebaseapp.com",
    projectId: "gestao-frota-tim",
    storageBucket: "gestao-frota-tim.firebasestorage.app",
    messagingSenderId: "455143595757",
    appId: "1:455143595757:web:036dc514ad7f983ca336e4",
    measurementId: "G-LDYRESTCTG"
};

const app = initializeApp(firebaseConfig);
export const auth = getAuth(app);
export const db = getFirestore(app);
export const storage = getStorage(app);
export const appId = "frota-tim-oficial";

export default app;
