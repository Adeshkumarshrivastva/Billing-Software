'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { AlertTriangle, Bell, CalendarDays, ChevronDown, FileHeart, LayoutDashboard, LogOut, Pill, Plus, Receipt, Settings, Stethoscope, Users, X } from 'lucide-react';
import { useMemo, useState } from 'react';
import { initialsFor } from '@/lib/format';
import { useBilling } from '@/lib/store';

const navItems: Array<{ href: string; label: string; icon: typeof LayoutDashboard; adminOnly?: boolean }> = [
  { href: '/', label: 'Overview', icon: LayoutDashboard },
  { href: '/bills', label: 'Bills', icon: Receipt, adminOnly: true },
  { href: '/activity', label: 'Day log', icon: CalendarDays },
  { href: '/patients', label: 'Patients', icon: Users },
  { href: '/prescriptions', label: 'Prescriptions', icon: Pill },
  { href: '/services', label: 'Services', icon: Stethoscope },
  { href: '/reports', label: 'Reports', icon: FileHeart },
];

export function AppShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const [mobileOpen, setMobileOpen] = useState(false);
  const [notice, setNotice] = useState(false);
  const { bills, profile, user, logout, error, formatCurrency } = useBilling();

  const pendingBills = useMemo(
    () => bills.filter((bill) => bill.status !== 'Paid').sort((a, b) => (a.date < b.date ? 1 : -1)),
    [bills],
  );
  const pendingCount = pendingBills.length;
  const workspaceInitials = profile.name.split(' ').map((word) => word[0]).slice(0, 2).join('').toUpperCase() || 'PC';

  // /login and /register are the two pages a signed-out visitor can reach —
  // they render full-screen with no sidebar/topbar chrome.
  if (pathname === '/login' || pathname === '/register') return <>{children}</>;

  const visibleNav = navItems.filter((item) => !item.adminOnly || user?.role === 'admin');

  return (
    <div className="app-layout">
      <aside className={`sidebar ${mobileOpen ? 'open' : ''}`}>
        <div className="brand">
          <div className="brand-row">
            <span className="brand-logo"><img src="/pmc-logo.png" alt="Positive Mind Care" /></span>
            <button className="icon-button mobile-close" onClick={() => setMobileOpen(false)} aria-label="Close menu"><X size={18} /></button>
          </div>
          <small className="brand-tagline">Tech Billing Software</small>
        </div>
        <div className="workspace-switcher"><span className="workspace-avatar">{workspaceInitials}</span><span><strong>{profile.name || 'Loading…'}</strong><small>Clinic workspace</small></span><ChevronDown size={15} /></div>
        <nav className="main-nav" aria-label="Main navigation">
          <small className="nav-label">Workspace</small>
          {visibleNav.map(({ href, label, icon: Icon }) => (
            <Link key={href} href={href} onClick={() => setMobileOpen(false)} className={pathname === href ? 'active' : ''}>
              <Icon size={17} />
              <span>{label}</span>
              {label === 'Bills' && pendingCount > 0 && <b className="nav-count">{pendingCount}</b>}
            </Link>
          ))}
          <small className="nav-label nav-label-lower">Manage</small>
          <Link href="/settings" onClick={() => setMobileOpen(false)} className={pathname === '/settings' ? 'active' : ''}><Settings size={17} /><span>Settings</span></Link>
        </nav>
        <div className="sidebar-bottom">
          <div className="help-card"><span className="help-dot">?</span><div><strong>Need a hand?</strong><small>Visit the help center</small></div></div>
          <div className="user-row">
            <span className="user-avatar">{user ? initialsFor(user.name) : '··'}</span>
            <span><strong>{user?.name ?? 'Signing in…'}</strong><small>{user?.email ?? ''}</small></span>
          </div>
          <button className="sidebar-signout" onClick={logout}><LogOut size={15} /> Sign out</button>
        </div>
      </aside>
      {mobileOpen && <button className="sidebar-overlay" onClick={() => setMobileOpen(false)} aria-label="Close menu" />}
      <main className="main-content">
        <header className="topbar">
          <button className="menu-button" onClick={() => setMobileOpen(true)} aria-label="Open menu"><span /><span /><span /></button>
          <div className="topbar-spacer" />
          {error && <span className="db-error" title={error}><AlertTriangle size={13} /> API unreachable</span>}
          {user?.role === 'admin' && (
            <div className="notification-wrap">
              <button className="notification-button" onClick={() => setNotice(!notice)} aria-label={`Notifications${pendingCount > 0 ? ` (${pendingCount} pending)` : ''}`}>
                <Bell size={18} />
                {pendingCount > 0 && <span className="notification-badge">{pendingCount > 99 ? '99+' : pendingCount}</span>}
              </button>
              {notice && (
                <>
                  <button className="notification-backdrop" onClick={() => setNotice(false)} aria-label="Close notifications" />
                  <div className="notification-panel">
                    <div className="notification-panel-head">
                      <strong>Notifications</strong>
                      {pendingCount > 0 && <span className="notification-count">{pendingCount}</span>}
                    </div>
                    {pendingCount === 0 ? (
                      <div className="notification-empty">All bills are settled — nothing pending.</div>
                    ) : (
                      <ul className="notification-list">
                        {pendingBills.slice(0, 8).map((bill) => (
                          <li key={bill.id}>
                            <Link href={`/bills/${encodeURIComponent(bill.id)}`} onClick={() => setNotice(false)}>
                              <span className="notification-dot" />
                              <div>
                                <strong>{bill.patientName}</strong>
                                <small>{bill.id} · {formatCurrency(bill.amount - bill.paidAmount)} due</small>
                              </div>
                            </Link>
                          </li>
                        ))}
                      </ul>
                    )}
                    {pendingCount > 8 && <Link href="/bills" className="notification-viewall" onClick={() => setNotice(false)}>View all {pendingCount} pending bills →</Link>}
                  </div>
                </>
              )}
            </div>
          )}
          {user?.role === 'admin' && <Link href="/bills/new" className="button primary topbar-action"><Plus size={16} /> New bill</Link>}
        </header>
        {children}
      </main>
      <style jsx>{` .app-layout{min-height:100vh;display:flex}.sidebar{width:252px;flex:0 0 252px;background:var(--surface);border-right:1px solid var(--line);display:flex;flex-direction:column;padding:26px 14px 18px;position:fixed;inset:0 auto 0 0;z-index:20;box-shadow:var(--shadow-sm);overflow-y:auto;overflow-x:hidden}
.brand{display:flex;flex-direction:column;gap:10px;padding:0 12px 26px}.brand-row{display:flex;align-items:center}.brand-logo{background:var(--paper);border:1px solid var(--line);border-radius:10px;padding:8px 12px;line-height:0}.brand-logo img{display:block;height:24px;width:auto}.brand-tagline{font-size:10px;font-weight:700;color:var(--gold);letter-spacing:.08em;text-transform:uppercase;padding-left:2px}.mobile-close{display:none;margin-left:auto}.workspace-switcher{display:flex;align-items:center;gap:9px;background:var(--paper);border:1px solid var(--line);padding:10px 8px;border-radius:10px;margin:0 6px 27px;font-size:11px}.workspace-switcher span:nth-child(2){display:flex;flex-direction:column;gap:3px;flex:1;min-width:0}.workspace-switcher strong{font-size:11px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;color:var(--ink)}.workspace-switcher small,.user-row small,.help-card small{color:var(--muted);font-size:10px}.workspace-switcher :global(svg){color:var(--muted)}.workspace-avatar,.user-avatar{width:28px;height:28px;display:grid;place-items:center;border-radius:8px;color:var(--primary);background:var(--primary-soft);font-size:9px;font-weight:700;flex-shrink:0}.main-nav{display:flex;flex-direction:column;gap:4px}.nav-label{padding:0 12px 8px;color:var(--muted);font-size:10px;font-weight:700;letter-spacing:.12em;text-transform:uppercase}.main-nav :global(a){display:flex;align-items:center;gap:12px;padding:11px 12px;border-radius:9px;color:var(--muted);font-size:13px;font-weight:600;transition:background .15s,color .15s}.main-nav :global(a:hover){background:var(--paper);color:var(--ink)}.main-nav :global(a.active){background:var(--primary-soft);color:var(--primary);box-shadow:inset 0 0 0 1px rgba(56,82,70,.18)}.nav-count{margin-left:auto;color:#0c1420;background:var(--gold);padding:2px 7px;border-radius:10px;font-size:10px;font-weight:700}.nav-label-lower{margin-top:25px}.sidebar-bottom{margin-top:auto}.help-card{display:flex;align-items:center;gap:10px;padding:12px;background:rgba(184,135,43,.1);border:1px solid rgba(184,135,43,.25);border-radius:10px;margin:0 6px 20px}.help-card div{display:flex;flex-direction:column;gap:3px;font-size:11px;color:var(--ink)}.help-dot{display:grid;place-items:center;width:23px;height:23px;border-radius:50%;background:var(--gold);color:#0c1420;font-weight:700;font-size:12px}.user-row{border-top:1px solid var(--line);padding:16px 8px 0;display:flex;align-items:center;gap:9px;font-size:11px}.user-row strong{color:var(--ink);display:block;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}.user-row span:nth-child(2){display:flex;flex-direction:column;gap:3px;flex:1;min-width:0}.user-row span:nth-child(2) small{white-space:nowrap;overflow:hidden;text-overflow:ellipsis}.user-row :global(svg){color:var(--muted)}.sidebar-signout{display:flex;align-items:center;justify-content:center;gap:8px;width:100%;margin-top:14px;padding:10px 12px;border:1px solid var(--line);border-radius:9px;background:var(--surface);color:var(--muted);font-size:12px;font-weight:700;cursor:pointer;transition:background .15s,color .15s,border-color .15s}.sidebar-signout:hover{color:var(--danger);border-color:rgba(180,35,24,.35);background:rgba(180,35,24,.07)}.sidebar-signout :global(svg){color:currentColor}.main-content{margin-left:252px;width:calc(100% - 252px);min-width:0}.topbar{height:76px;display:flex;align-items:center;padding:0 42px;border-bottom:1px solid var(--line);background:rgba(245,246,250,.85);backdrop-filter:blur(10px);position:sticky;top:0;z-index:15}.topbar-spacer{flex:1}.db-error{display:flex;align-items:center;gap:6px;color:var(--danger);background:var(--danger-soft);font-size:11px;font-weight:700;padding:6px 10px;border-radius:8px;margin-right:14px}.notification-wrap{position:relative;margin-right:18px}.notification-button{border:0;background:transparent;color:var(--muted);position:relative;z-index:6;padding:8px}.notification-badge{position:absolute;top:2px;right:0;min-width:16px;height:16px;padding:0 4px;border-radius:999px;background:var(--danger);color:#fff;font-size:10px;font-weight:700;line-height:16px;text-align:center;border:2px solid var(--paper)}.notification-backdrop{position:fixed;inset:0;z-index:4;background:transparent;border:0;cursor:default}.notification-panel{position:absolute;right:0;top:44px;width:320px;max-width:calc(100vw - 40px);background:var(--surface);border:1px solid var(--line);border-radius:12px;box-shadow:var(--shadow-lg);z-index:6;overflow:hidden}.notification-panel-head{display:flex;align-items:center;justify-content:space-between;padding:13px 16px;border-bottom:1px solid var(--line);font-size:13px}.notification-count{background:var(--danger-soft);color:var(--danger);font-size:10px;font-weight:700;padding:2px 8px;border-radius:999px}.notification-empty{padding:22px 16px;color:var(--muted);font-size:12px;text-align:center}.notification-list{list-style:none;margin:0;padding:6px;max-height:320px;overflow-y:auto}.notification-list :global(a){display:flex;align-items:flex-start;gap:10px;padding:9px 10px;border-radius:9px;color:inherit}.notification-list :global(a:hover){background:var(--paper)}.notification-list strong{display:block;font-size:12.5px}.notification-list small{color:var(--muted);font-size:11px}.notification-dot{width:7px;height:7px;border-radius:50%;background:var(--danger);margin-top:5px;flex-shrink:0}.notification-panel :global(.notification-viewall){display:block;text-align:center;padding:11px;border-top:1px solid var(--line);font-size:12px;font-weight:700;color:var(--primary)}.menu-button{display:none}.sidebar-overlay{display:none}@media(max-width:800px){.sidebar{transform:translateX(-100%);transition:transform .2s}.sidebar.open{transform:translateX(0)}.mobile-close{display:grid}.sidebar-overlay{display:block;position:fixed;inset:0;background:rgba(9,14,24,.4);border:0;z-index:10}.main-content{margin-left:0;width:100%}.topbar{padding:0 20px;height:64px}.menu-button{display:flex;flex-direction:column;gap:4px;border:0;background:none;padding:8px 8px 8px 0}.menu-button span{display:block;width:19px;height:2px;background:var(--ink)}:global(.topbar-action){padding:10px 11px;font-size:12px}.notification-wrap{margin-right:5px}.notification-panel{right:-10px}.db-error span{display:none}} `}</style>
    </div>
  );
}
