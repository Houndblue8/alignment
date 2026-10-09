import { CalendarDays, Home, ListChecks, Quote, Settings } from 'lucide-react';
import { NavLink } from 'react-router-dom';

const LINKS = [
  { to: '/', label: 'Home', icon: Home },
  { to: '/today', label: 'Today', icon: ListChecks },
  { to: '/week', label: 'Week', icon: CalendarDays },
  { to: '/quotes', label: 'Quotes', icon: Quote },
  { to: '/settings', label: 'Settings', icon: Settings },
];

export function Nav() {
  return (
    <nav className="nav" aria-label="Main">
      <span className="brand">Alignment</span>
      {LINKS.map(({ to, label, icon: Icon }) => (
        <NavLink key={to} to={to} end={to === '/'}>
          <Icon size={22} strokeWidth={1.75} aria-hidden="true" />
          <span>{label}</span>
        </NavLink>
      ))}
    </nav>
  );
}
