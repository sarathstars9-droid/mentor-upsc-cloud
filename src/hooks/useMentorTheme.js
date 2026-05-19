import { useState, useEffect } from 'react';

/**
 * Premium Theme Hook for MentorOS
 * Handles system preference, localStorage persistence, and DOM updates.
 */
export function useMentorTheme() {
  // Initialize from localStorage or system preference
  const getInitialTheme = () => {
    const savedTheme = localStorage.getItem('mos-theme');
    if (savedTheme) return savedTheme;
    
    return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
  };

  const [theme, setTheme] = useState(getInitialTheme);

  useEffect(() => {
    // Apply to document root
    document.documentElement.setAttribute('data-theme', theme);
    // Persist
    localStorage.setItem('mos-theme', theme);
    
    // Meta tag color update (optional but premium)
    const metaThemeColor = document.querySelector('meta[name="theme-color"]');
    if (metaThemeColor) {
      metaThemeColor.setAttribute('content', theme === 'dark' ? '#0a0b10' : '#f9f8f4');
    }
  }, [theme]);

  const toggleTheme = () => {
    setTheme(prev => (prev === 'dark' ? 'light' : 'dark'));
  };

  return { theme, setTheme, toggleTheme };
}

export { useMentorTheme as useTheme };
