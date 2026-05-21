import { Link, useLocation } from 'react-router-dom';
import { Home, Compass, Briefcase, TrendingUp, BookOpen } from 'lucide-react';

const navItems = [
  { path: '/', label: 'Home', icon: Home },
  { path: '/discover', label: 'Discover', icon: Compass },
  { path: '/portfolio', label: 'Portfolio', icon: Briefcase },
  { path: '/performance', label: 'Performance', icon: TrendingUp },
  { path: '/learn', label: 'Learn', icon: BookOpen },
];

export function BottomNav() {
  const location = useLocation();

  const isActive = (path) => {
    if (path === '/') return location.pathname === '/';
    return location.pathname.startsWith(path);
  };

  return (
    <nav className="bottomnav">
      {navItems.map(item => (
        <Link
          key={item.path}
          to={item.path}
          className={`bottomnav-item ${isActive(item.path) ? 'active' : ''}`}
        >
          <item.icon size={20} strokeWidth={isActive(item.path) ? 2.5 : 1.8} />
          <span>{item.label}</span>
        </Link>
      ))}
    </nav>
  );
}
