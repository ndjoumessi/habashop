interface EmptyStateProps {
  icon:    string
  title:   string
  message: string
  action?: { label: string; onClick: () => void }
}

export default function EmptyState({ icon, title, message, action }: EmptyStateProps) {
  return (
    <div style={{
      textAlign: 'center', padding: '48px 24px',
      display: 'flex', flexDirection: 'column',
      alignItems: 'center', gap: 12,
    }}>
      <div style={{ fontSize: 40, opacity: .5 }} aria-hidden="true">{icon}</div>
      <div style={{ fontSize: 16, fontWeight: 'var(--fw-semibold)', color: 'var(--text)' }}>{title}</div>
      <div style={{
        fontSize: 13, color: 'var(--text3)',
        maxWidth: 280, lineHeight: 1.6,
      }}>{message}</div>
      {action && (
        <button
          type="button"
          className="topbar-btn"
          style={{ marginTop: 8 }}
          onClick={action.onClick}
        >
          {action.label}
        </button>
      )}
    </div>
  )
}
