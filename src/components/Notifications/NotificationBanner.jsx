import React from 'react';
import { useNotifications } from '../../hooks/useNotifications';

export default function NotificationBanner({ userId }) {
  console.log('[NotificationBanner] Component rendered with userId:', userId);
  const { notifications, markAsRead } = useNotifications(userId);

  console.log('[NotificationBanner] Current notifications:', notifications);

  if (!userId || !notifications || notifications.length === 0) {
    console.log('[NotificationBanner] Returning null. userId:', userId, 'notifications length:', notifications?.length);
    return null;
  }

  // Find the first distraction alert or just the first notification
  const distractionAlert = notifications.find(n => n.type === 'DISTRACTION_ALERT') || notifications[0];

  return (
    <div style={{
      position: 'fixed',
      top: 0,
      left: 0,
      width: '100%',
      backgroundColor: distractionAlert.severity === 'warning' ? '#ff3b30' : '#007aff',
      color: '#fff',
      zIndex: 9999,
      padding: '16px 24px',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'space-between',
      boxShadow: '0 4px 12px rgba(0,0,0,0.15)',
      animation: 'slideDown 0.3s ease-out'
    }}>
      <style>
        {`
          @keyframes slideDown {
            from { transform: translateY(-100%); }
            to { transform: translateY(0); }
          }
        `}
      </style>
      <div style={{ flex: 1 }}>
        <h3 style={{ margin: '0 0 4px 0', fontSize: '18px', fontWeight: 'bold' }}>
          {distractionAlert.title}
        </h3>
        <p style={{ margin: 0, fontSize: '14px', lineHeight: '1.4' }}>
          {distractionAlert.message}
        </p>
      </div>
      <div>
        <button
          onClick={() => markAsRead(distractionAlert.id)}
          style={{
            backgroundColor: 'rgba(255, 255, 255, 0.2)',
            color: '#fff',
            border: '1px solid #fff',
            padding: '8px 16px',
            borderRadius: '4px',
            cursor: 'pointer',
            fontWeight: 'bold',
            marginLeft: '16px',
            transition: 'background 0.2s'
          }}
          onMouseOver={(e) => e.target.style.backgroundColor = 'rgba(255, 255, 255, 0.3)'}
          onMouseOut={(e) => e.target.style.backgroundColor = 'rgba(255, 255, 255, 0.2)'}
        >
          Dismiss
        </button>
      </div>
    </div>
  );
}
