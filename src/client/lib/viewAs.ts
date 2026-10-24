// Development only: an admin can view the app as a regular user. The switch
// lives in the account menus; while it's on, every API call carries
// `X-View-As: user` and the dev server (requireAuth) drops isAdmin, so the
// profile, menus and permissions all match a normal account. Production
// builds compile this to false (webpack sets NODE_ENV from --mode), and the
// production server ignores the header.

export const VIEW_AS_AVAILABLE = process.env.NODE_ENV === 'development';

const KEY = 'tailme:viewAsUser';

export function viewingAsUser(): boolean {
  if (!VIEW_AS_AVAILABLE) return false;
  try {
    return localStorage.getItem(KEY) === '1';
  } catch {
    return false;
  }
}

/** Flips the view and reloads, so everything refetches as the other role */
export function setViewingAsUser(on: boolean) {
  try {
    if (on) localStorage.setItem(KEY, '1');
    else localStorage.removeItem(KEY);
  } catch {
    return;
  }
  window.location.reload();
}
