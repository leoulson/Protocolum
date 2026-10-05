import { initializeApp, getApps } from 'https://www.gstatic.com/firebasejs/12.19.0/firebase-app.js';
import {
  getAuth, GoogleAuthProvider, signInWithPopup, signInWithRedirect, getRedirectResult,
  signOut, setPersistence, browserLocalPersistence, inMemoryPersistence, onAuthStateChanged
} from 'https://www.gstatic.com/firebasejs/12.19.0/firebase-auth.js';
import { getFirestore } from 'https://www.gstatic.com/firebasejs/12.19.0/firebase-firestore.js';
import { firebaseConfig, getClientFirebaseConfig } from './firebase-config.js';

const text = (pt, en) => document.documentElement.lang.startsWith('en') ? en : pt;
const showError = message => {
  const target = document.getElementById('authError');
  if (target) target.textContent = message;
};
const messages = {
  'auth/unauthorized-domain': ['Este domínio não está autorizado para login no Firebase.', 'This domain is not authorized for Firebase sign-in.'],
  'auth/operation-not-allowed': ['O provedor Google não está ativado neste projeto Firebase.', 'Google sign-in is not enabled for this Firebase project.'],
  'auth/popup-blocked': ['O navegador bloqueou a janela do Google. Permita pop-ups e tente novamente.', 'The browser blocked the Google window. Allow pop-ups and try again.'],
  'auth/popup-closed-by-user': ['A janela do Google foi fechada. Você pode tentar novamente.', 'The Google window was closed. You can try again.'],
  'auth/cancelled-popup-request': ['Conclua a janela do Google que já está aberta.', 'Complete the Google window that is already open.'],
  'auth/network-request-failed': ['Não foi possível conectar ao Google/Firebase. Verifique a conexão.', 'Could not connect to Google/Firebase. Check your connection.'],
  'auth/invalid-api-key': ['A configuração do Firebase não foi reconhecida.', 'The Firebase configuration was not recognized.'],
  'auth/account-exists-with-different-credential': ['Este e-mail já está vinculado a outro método de login.', 'This email is already linked to a different sign-in method.'],
  'auth/web-storage-unsupported': ['O navegador não permite o armazenamento necessário para o login.', 'The browser does not allow the storage required for sign-in.']
};
const reportError = error => {
  const message = messages[error?.code];
  showError(message ? text(...message) : text('Não foi possível entrar com Google. Tente novamente.', 'Could not sign in with Google. Try again.'));
  console.warn('Protocolum Google sign-in:', error?.code || 'initialization-failed');
};
let ready = false;
let busy = false;
let stopForumSync;
let identityRevision = 0;
export let db = null;
export let auth = null;

function updateButton() {
  const button = document.getElementById('googleSignInBtn');
  if (!button) return;
  button.disabled = !ready || busy;
  button.setAttribute('aria-busy', String(busy));
}
window.protocolumRefreshGoogleButton = updateButton;

const config = getClientFirebaseConfig(location.hostname);
const validConfig = ['apiKey', 'authDomain', 'projectId', 'appId'].every(key =>
  typeof firebaseConfig[key] === 'string' && !!firebaseConfig[key].trim());

async function startSignIn() {
  if (location.protocol !== 'http:' && location.protocol !== 'https:') {
    showError(text('Abra o site por localhost ou HTTPS para entrar com Google.', 'Open the site on localhost or HTTPS to sign in with Google.'));
    return;
  }
  if (!ready || busy) return;
  busy = true;
  updateButton();
  showError('');
  auth.languageCode = document.documentElement.lang.startsWith('en') ? 'en' : 'pt-BR';
  const provider = new GoogleAuthProvider();
  provider.setCustomParameters({ prompt: 'select_account' });
  // Redirect only where auth helpers are served on the same Firebase Hosting origin.
  // Local development and other origins use a popup instead.
  const sameOriginHelpers = config.authDomain === location.hostname;
  const mobile = window.matchMedia('(pointer: coarse)').matches || window.matchMedia('(display-mode: standalone)').matches;
  try {
    if (mobile && sameOriginHelpers) {
      await signInWithRedirect(auth, provider);
    } else {
      // Persistence is set during initialization, keeping the popup in the click gesture.
      try { await signInWithPopup(auth, provider); }
      catch (error) {
        if (error.code === 'auth/popup-blocked' && sameOriginHelpers) await signInWithRedirect(auth, provider);
        else throw error;
      }
    }
  } catch (error) { reportError(error); }
  finally { busy = false; updateButton(); }
}
window.startGoogleAuth = startSignIn;

window.googleAuthSignOut = async () => {
  if (auth) await signOut(auth);
};
async function initializeGoogleAuth() {
  if (!validConfig) {
    showError(text('O login Google aguarda a configuração do Firebase.', 'Google sign-in is awaiting Firebase configuration.'));
    return;
  }
  try {
    const app = getApps().find(item => item.name === '[DEFAULT]') || initializeApp(config);
    auth = getAuth(app);
    db = getFirestore(app);
    // Storage failures still allow signing in for the current page session.
    try { await setPersistence(auth, browserLocalPersistence); }
    catch { await setPersistence(auth, inMemoryPersistence); }

    onAuthStateChanged(auth, user => {
      const revision = ++identityRevision;
      window.protocolumStopNetwork?.();
      stopForumSync?.();
      stopForumSync = undefined;
      if (!user) {
        window.clinicalMindUser = null;
        window.clinicalMindGoogleSignOutSuccess?.();
        return;
      }
      const email = user.email || user.providerData.find(item => item.email)?.email || '';
      window.clinicalMindUser = {
        uid: user.uid, email,
        name: user.displayName || (email ? email.split('@')[0] : text('Usuário', 'User')),
        photoURL: user.photoURL || ''
      };
      window.clinicalMindGoogleSuccess?.(window.clinicalMindUser);
      // Existing optional cloud features cannot prevent authentication from succeeding.
      import('./cloud-sync.js').then(async module => {
        if (revision !== identityRevision || auth.currentUser?.uid !== user.uid) return;
        await module.syncPubMedAppraisals(user.uid);
        if (revision !== identityRevision || auth.currentUser?.uid !== user.uid) return;
        const unsubscribe = await module.syncForumPosts();
        if (revision === identityRevision) stopForumSync = unsubscribe;
        else unsubscribe?.();
      }).catch(() => console.warn('Protocolum: optional cloud synchronization is unavailable.'));
    }, reportError);
    ready = true;
    updateButton();
    getRedirectResult(auth).catch(reportError);
  } catch (error) { reportError(error); }
}
initializeGoogleAuth();
