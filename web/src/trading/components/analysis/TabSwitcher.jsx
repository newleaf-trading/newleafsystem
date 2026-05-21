export default function TabSwitcher({ activeTab, onTabChange }) {
  const tabs = [
    { id: 'gamma', label: 'Gamma Analysis' },
    { id: 'technical', label: 'Technical Analysis' }
  ]

  return (
    <div
      style={{
        display: 'flex',
        gap: '8px',
        padding: '6px',
        background: 'var(--nl-surface)',
        borderRadius: '12px',
        border: '1px solid var(--nl-border)',
        marginBottom: '24px',
      }}
    >
      {tabs.map(tab => (
        <button
          key={tab.id}
          onClick={() => onTabChange(tab.id)}
          style={{
            flex: 1,
            padding: '10px 20px',
            fontSize: '13px',
            fontWeight: '700',
            borderRadius: '8px',
            border: 'none',
            background: activeTab === tab.id ? 'var(--nl-primary-green)' : 'transparent',
            color: activeTab === tab.id ? 'white' : 'var(--nl-muted-text)',
            cursor: 'pointer',
            transition: 'all 0.2s ease',
            textTransform: 'uppercase',
            letterSpacing: '0.05em',
          }}
          onMouseEnter={(e) => {
            if (activeTab !== tab.id) {
              e.target.style.background = 'rgba(0,0,0,0.03)'
            }
          }}
          onMouseLeave={(e) => {
            if (activeTab !== tab.id) {
              e.target.style.background = 'transparent'
            }
          }}
        >
          {tab.label}
        </button>
      ))}
    </div>
  )
}
