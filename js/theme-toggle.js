// theme-toggle.js - Permet de basculer entre le mode clair et le mode sombre

(function() {
  'use strict';

  const toggleButton = document.getElementById('themeToggle');
  const STORAGE_KEY = 'artisanconnect-theme';

  const updateToggleVisual = (isDark) => {
    if (!toggleButton) return;
    toggleButton.setAttribute('aria-pressed', isDark ? 'true' : 'false');
    toggleButton.setAttribute('aria-label', isDark ? 'Activer le mode clair' : 'Activer le mode sombre');
    toggleButton.innerHTML = isDark
      ? '<i class="fas fa-sun" aria-hidden="true"></i>'
      : '<i class="fas fa-moon" aria-hidden="true"></i>';
  };

  const applyTheme = (mode) => {
    const isDark = mode === 'dark';
    document.body.classList.toggle('dark-mode', isDark);
    updateToggleVisual(isDark);
  };

  const getStoredTheme = () => {
    try {
      return localStorage.getItem(STORAGE_KEY);
    } catch (error) {
      return null;
    }
  };

  const setStoredTheme = (mode) => {
    try {
      localStorage.setItem(STORAGE_KEY, mode);
    } catch (error) {
      // stockage non bloquant
    }
  };

  const savedTheme = getStoredTheme();
  const initialMode = savedTheme || (document.body.classList.contains('dark-mode') ? 'dark' : 'light');
  applyTheme(initialMode);

  if (toggleButton) {
    toggleButton.addEventListener('click', function() {
      const isDark = !document.body.classList.contains('dark-mode');
      const mode = isDark ? 'dark' : 'light';
      applyTheme(mode);
      setStoredTheme(mode);
    });
  }
})();
