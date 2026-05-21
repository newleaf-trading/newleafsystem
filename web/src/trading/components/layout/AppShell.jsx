import { TopNav } from './TopNav';
import { BottomNav } from './BottomNav';

export function AppShell({ user, onSignOut, onVoiceOpen, children }) {
  return (
    <div className="app-shell">
      <TopNav user={user} onSignOut={onSignOut} onVoiceOpen={onVoiceOpen} />
      <main className="app-main">
        {children}
      </main>
      <BottomNav />
    </div>
  );
}
