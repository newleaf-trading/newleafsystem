/**
 * Firebase authentication for the workbench static nav.
 * Injected as type="module" into nav-component.html by the build script.
 * Replaces static Sign In / Get Started buttons with working Firebase auth.
 */
import { initializeApp } from "https://www.gstatic.com/firebasejs/10.13.2/firebase-app.js";
import { getAuth, GoogleAuthProvider, signInWithPopup, signOut, onAuthStateChanged }
  from "https://www.gstatic.com/firebasejs/10.13.2/firebase-auth.js";

const app = initializeApp({
  apiKey: "AIzaSyBHOeCWF_Z-xATalX911Q_0isAKsJzHpwk",
  authDomain: "newleaf-trading.firebaseapp.com",
  projectId: "newleaf-trading",
  storageBucket: "newleaf-trading.firebasestorage.app",
  messagingSenderId: "240392819045",
  appId: "1:240392819045:web:a1dc19e5dcfa29e6cdd18c"
});
const auth = getAuth(app);

// Expose the signed-in session to workbench surfaces (TIQ, etc.) so they can call
// the API with the Firebase ID token — no manual API key needed. Reuses this same
// default app, so the persisted session is shared across every workbench page.
window.__nlAuthReady = new Promise(function (res) { onAuthStateChanged(auth, function () { res(); }); });
window.__nlGetIdToken = function () { return auth.currentUser ? auth.currentUser.getIdToken() : Promise.resolve(null); };

function getInitials(user) {
  if (user.displayName) {
    return user.displayName.split(' ').map(function (n) { return n[0]; }).join('').toUpperCase().slice(0, 2);
  }
  return user.email ? user.email.charAt(0).toUpperCase() : 'U';
}

function signedOutHTML() {
  return '<button class="nl-nav-ghost" id="navSignIn">Sign In</button>' +
    '<a href="/invest" class="nl-nav-cta">Get Started &rarr;</a>';
}

function signedInHTML(user) {
  var initials = getInitials(user);
  return '<div class="nl-nav-user">' +
    '<div class="nl-nav-avatar">' + initials + '</div>' +
    '<button class="nl-nav-ghost" id="navSignOut" style="height:auto;padding:0 12px">Sign Out</button>' +
    '</div>';
}

function mobileSignedOutHTML() {
  return '<button class="nl-nav-ghost nl-mobile-btn" id="mobileSignIn">Sign In</button>' +
    '<a href="/invest" class="nl-nav-cta nl-mobile-btn">Get Started &rarr;</a>';
}

function mobileSignedInHTML(user) {
  var initials = getInitials(user);
  return '<div class="nl-mobile-auth">' +
    '<div class="nl-nav-avatar">' + initials + '</div>' +
    '<button class="nl-nav-ghost" id="mobileSignOut">Sign Out</button>' +
    '</div>';
}

onAuthStateChanged(auth, function (user) {
  // Desktop auth zone
  var navRight = document.querySelector('.nl-nav-right');
  if (navRight) {
    // Find or create auth container
    var authEl = navRight.querySelector('.nl-nav-auth');
    if (!authEl) {
      authEl = document.createElement('div');
      authEl.className = 'nl-nav-auth';
      // Remove static auth buttons rendered by SSR
      var ghost = navRight.querySelector('.nl-nav-ghost');
      var cta = navRight.querySelector('.nl-nav-cta');
      if (ghost) ghost.remove();
      if (cta) cta.remove();
      navRight.appendChild(authEl);
    }
    authEl.innerHTML = user ? signedInHTML(user) : signedOutHTML();

    // Attach event listeners
    var signInBtn = document.getElementById('navSignIn');
    var signOutBtn = document.getElementById('navSignOut');
    if (signInBtn) signInBtn.addEventListener('click', function () { signInWithPopup(auth, new GoogleAuthProvider()); });
    if (signOutBtn) signOutBtn.addEventListener('click', function () { signOut(auth); });
  }

  // Mobile auth zone
  var mobileUtility = document.querySelector('.nl-mobile-utility');
  if (mobileUtility) {
    // Remove static mobile auth buttons
    var mobileGhost = mobileUtility.querySelector('.nl-nav-ghost');
    var mobileCta = mobileUtility.querySelector('.nl-nav-cta');
    if (mobileGhost) mobileGhost.remove();
    if (mobileCta) mobileCta.remove();

    // Find or create mobile auth container
    var mobileAuthEl = mobileUtility.querySelector('.nl-mobile-auth-zone');
    if (!mobileAuthEl) {
      mobileAuthEl = document.createElement('div');
      mobileAuthEl.className = 'nl-mobile-auth-zone';
      mobileUtility.appendChild(mobileAuthEl);
    }
    mobileAuthEl.innerHTML = user ? mobileSignedInHTML(user) : mobileSignedOutHTML();

    var mobileSignInBtn = document.getElementById('mobileSignIn');
    var mobileSignOutBtn = document.getElementById('mobileSignOut');
    if (mobileSignInBtn) mobileSignInBtn.addEventListener('click', function () { signInWithPopup(auth, new GoogleAuthProvider()); });
    if (mobileSignOutBtn) mobileSignOutBtn.addEventListener('click', function () { signOut(auth); });
  }
});
