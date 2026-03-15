'use client';

import { useEffect, useState } from 'react';
import AuthPanel from '@/components/AuthPanel';

export default function NavBar() {
  const [currentPath, setCurrentPath] = useState('/');

  useEffect(() => {
    setCurrentPath(window.location.pathname);

    const handlePopState = () => setCurrentPath(window.location.pathname);
    window.addEventListener('popstate', handlePopState);
    return () => window.removeEventListener('popstate', handlePopState);
  }, []);

  const navItems = [
    { label: 'Skyline', href: '/' },
    { label: 'Buildings', href: '/buildings' },
    { label: 'Analytics', href: '/analytics' },
  ];

  const isActive = (href: string) => {
    if (href === '/') return currentPath === '/';
    return currentPath.startsWith(href);
  };

  const handleNav = (e: React.MouseEvent<HTMLAnchorElement>, href: string) => {
    e.preventDefault();
    window.history.pushState({}, '', href);
    setCurrentPath(href);
    window.dispatchEvent(new PopStateEvent('popstate'));
  };

  return (
    <header className="border-b border-gray-800 px-6 py-3 flex items-center justify-between gap-3">
      <div className="flex items-center gap-6">
        <a
          href="/"
          onClick={(e) => handleNav(e, '/')}
          className="flex items-center gap-3 shrink-0"
        >
          <span className="text-2xl" aria-hidden="true">🏙️</span>
          <div>
            <h1 className="text-xl font-bold tracking-tight">CRE View</h1>
            <p className="text-xs text-gray-400 hidden sm:block">Skyline Financial Intelligence</p>
          </div>
        </a>

        <nav className="flex items-center gap-1" aria-label="Main navigation">
          {navItems.map(({ label, href }) => (
            <a
              key={href}
              href={href}
              onClick={(e) => handleNav(e, href)}
              className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${
                isActive(href)
                  ? 'bg-brand-500/20 text-brand-400'
                  : 'text-gray-400 hover:text-white hover:bg-gray-800'
              }`}
            >
              {label}
            </a>
          ))}
        </nav>
      </div>

      <AuthPanel />
    </header>
  );
}
