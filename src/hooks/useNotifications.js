import { useState, useEffect } from 'react';
import { BACKEND_URL } from '../config';

export function useNotifications(userId) {
  const [notifications, setNotifications] = useState([]);

  useEffect(() => {
    console.log('[useNotifications] Hook mounted. userId:', userId);
    if (!userId) return;

    const fetchUnread = async () => {
      console.log(`[useNotifications] Fetching from: ${BACKEND_URL}/api/notifications/unread?userId=${encodeURIComponent(userId)}`);
      try {
        const res = await fetch(`${BACKEND_URL}/api/notifications/unread?userId=${encodeURIComponent(userId)}`);
        const data = await res.json();
        console.log('[useNotifications] Response JSON:', data);
        if (data.ok) {
          setNotifications(data.notifications || []);
        }
      } catch (err) {
        console.error('Failed to fetch unread notifications', err);
      }
    };

    // Initial fetch
    fetchUnread();

    // Poll every 30 seconds
    const intervalId = setInterval(fetchUnread, 30000);

    return () => clearInterval(intervalId);
  }, [userId]);

  const markAsRead = async (id) => {
    try {
      const res = await fetch(`${BACKEND_URL}/api/notifications/${id}/read`, { 
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ userId })
      });
      const data = await res.json();
      if (data.ok) {
        setNotifications((prev) => prev.filter(n => n.id !== id));
      }
    } catch (err) {
      console.error('Failed to mark notification as read', err);
    }
  };

  return { notifications, markAsRead };
}
