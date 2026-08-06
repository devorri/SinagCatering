import { PieChart, BookOpen, Calendar, Users, Star, MessageSquare, X } from 'lucide-react';

type AdminTabType = 'analytics' | 'bookings' | 'calendar' | 'staff' | 'reviews' | 'inquiries';

type AdminDrawerProps = {
  activeTab: AdminTabType;
  setActiveTab: (tab: AdminTabType) => void;
  onClose: () => void;
  isOpen: boolean;
};

const navItems: { id: AdminTabType; label: string; icon: React.ReactNode }[] = [
  { id: 'analytics', label: 'Overview & Reports', icon: <PieChart size={20} /> },
  { id: 'bookings', label: 'Bookings Register', icon: <BookOpen size={20} /> },
  { id: 'calendar', label: 'Date Availability', icon: <Calendar size={20} /> },
  { id: 'staff', label: 'Staff Directory', icon: <Users size={20} /> },
  { id: 'reviews', label: 'Reviews & Feedback', icon: <Star size={20} /> },
  { id: 'inquiries', label: 'Inquiry Inbox', icon: <MessageSquare size={20} /> },
];

export default function AdminDrawer({ activeTab, setActiveTab, onClose, isOpen }: AdminDrawerProps) {
  return (
    <nav className={`admin-drawer ${isOpen ? 'open' : ''}`} aria-label="Admin navigation" role="navigation">
      <div className="drawer-header" style={{ padding: '20px 16px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', borderBottom: '1px solid var(--line)' }}>
        <span style={{ fontWeight: 700, fontSize: '1rem', fontFamily: 'var(--font-serif)', color: 'var(--terracotta)' }}>
          Executive Console
        </span>
        <button onClick={onClose} aria-label="Close menu" style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--muted)', padding: '4px' }}>
          <X size={20} />
        </button>
      </div>
      <ul style={{ listStyle: 'none', padding: '12px 0', margin: 0 }}>
        {navItems.map((item) => (
          <li key={item.id}>
            <button
              className={`drawer-nav-item ${activeTab === item.id ? 'active' : ''}`}
              onClick={() => {
                setActiveTab(item.id);
                onClose();
              }}
              aria-current={activeTab === item.id ? 'page' : undefined}
            >
              <span className="icon-wrapper" style={{ marginRight: '12px', display: 'inline-flex' }}>
                {item.icon}
              </span>
              {item.label}
            </button>
          </li>
        ))}
      </ul>
    </nav>
  );
}

