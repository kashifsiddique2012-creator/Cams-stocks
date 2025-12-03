// Simple client-side admin gate using a passphrase.
// WARNING: client-side protection is convenient for demos but NOT cryptographically secure.
// Anyone who inspects the deployed JS or localStorage can find/overwrite the passphrase.
// For production, use server-side auth (Netlify Identity, OAuth, etc.).
(function(){
  const INITIAL_PASSPHRASE = "bR7$k9Vw!mG2qZ4t#L8xP%bN6sY0uF2"; // <- your passphrase
  const storageKey = 'siteAdminLoggedIn';
  const passphraseKey = 'siteAdminPassphrase';

  // Helper: hide/show admin-only elements
  function setAdminVisible(visible){
    document.querySelectorAll('.admin-only').forEach(el=>{
      el.style.display = visible ? '' : 'none';
      if(!visible) el.setAttribute('aria-hidden','true');
      else el.removeAttribute('aria-hidden');
    });
    const btn = document.getElementById('admin-login-btn');
    if(btn) btn.textContent = visible ? 'Admin (logged in) — Logout' : 'Admin Login';
  }

  // Create admin login button (persistent at top-right)
  function ensureAdminButton(){
    if(document.getElementById('admin-login-btn')) return;
    const btn = document.createElement('button');
    btn.id = 'admin-login-btn';
    btn.type = 'button';
    btn.style.position = 'fixed';
    btn.style.right = '12px';
    btn.style.top = '12px';
    btn.style.zIndex = 9999;
    btn.setAttribute('aria-haspopup','dialog');
    btn.addEventListener('click', adminButtonHandler);
    document.body.appendChild(btn);
  }

  // Handler
  function adminButtonHandler(){
    const loggedIn = isLoggedIn();
    if(loggedIn){
      // Logout
      localStorage.removeItem(storageKey);
      announce('Admin logged out');
      setAdminVisible(false);
      return;
    }
    // If no passphrase stored, and INITIAL_PASSPHRASE is set, store it once
    if(!localStorage.getItem(passphraseKey) && INITIAL_PASSPHRASE){
      localStorage.setItem(passphraseKey, INITIAL_PASSPHRASE);
    }
    const hasPass = !!localStorage.getItem(passphraseKey);
    if(!hasPass){
      // Allow creating a passphrase on first use
      const newPass = prompt('Create an admin passphrase (save it somewhere safe):');
      if(newPass && newPass.length >= 4){
        localStorage.setItem(passphraseKey, newPass);
        alert('Passphrase saved locally. Use it to login in future visits.');
      } else {
        alert('Passphrase must be at least 4 characters.');
        return;
      }
    }
    const attempt = prompt('Enter admin passphrase:');
    const stored = localStorage.getItem(passphraseKey);
    if(attempt === stored){
      localStorage.setItem(storageKey, '1');
      announce('Admin login successful. Controls unlocked.');
      setAdminVisible(true);
    } else {
      announce('Incorrect passphrase.');
      alert('Incorrect passphrase.');
    }
  }

  function isLoggedIn(){ return !!localStorage.getItem(storageKey); }

  function announce(msg){
    let region = document.getElementById('live-announcer');
    if(!region){
      region = document.createElement('div');
      region.id = 'live-announcer';
      region.setAttribute('aria-live','polite');
      region.className = 'sr-only';
      document.body.appendChild(region);
    }
    region.textContent = msg;
  }

  // Init
  ensureAdminButton();
  setAdminVisible(isLoggedIn());
  // small visual hint for non-admins: add a notice near first admin-only element
  const firstAdmin = document.querySelector('.admin-only');
  if(firstAdmin && !isLoggedIn()){
    const note = document.createElement('div');
    note.className = 'admin-note';
    note.style.fontSize = '0.9rem';
    note.style.color = '#666';
    note.textContent = 'Interactive controls are admin-only. Click "Admin Login" to unlock.';
    firstAdmin.parentNode.insertBefore(note, firstAdmin);
  }
})();