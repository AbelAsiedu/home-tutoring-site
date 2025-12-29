/* Dark Mode Toggle Script */
document.addEventListener('DOMContentLoaded', function() {
  const THEME_KEY = 'theme-preference';
  
  // Get saved preference or default to light (initial design)
  const getSavedTheme = () => {
    const saved = localStorage.getItem(THEME_KEY);
    if (saved) return saved;
    return 'light';
  };
  
  // Apply theme
  const applyTheme = (theme) => {
    if (theme === 'dark') {
      document.documentElement.setAttribute('data-theme', 'dark');
      localStorage.setItem(THEME_KEY, 'dark');
    } else {
      document.documentElement.removeAttribute('data-theme');
      localStorage.setItem(THEME_KEY, 'light');
    }
    updateToggleButton();
  };
  
  // Update toggle button appearance
  const updateToggleButton = () => {
    const btn = document.getElementById('dark-mode-toggle');
    if (!btn) return;
    
    const isDark = document.documentElement.getAttribute('data-theme') === 'dark';
    btn.innerHTML = isDark ? '☀️ Light' : '🌙 Dark';
    btn.setAttribute('aria-pressed', isDark);
  };
  
  // Create toggle button if it doesn't exist
  const createToggleButton = () => {
    let btn = document.getElementById('dark-mode-toggle');
    if (btn) return;
    
    btn = document.createElement('button');
    btn.id = 'dark-mode-toggle';
    btn.className = 'btn ghost';
    btn.style.cssText = `
      position: relative;
      z-index: 30;
      padding: 8px 12px;
      border-radius: 10px;
      border: 1px solid var(--border-light);
      background: transparent;
      color: var(--accent-2);
      cursor: pointer;
      font-weight: 600;
      transition: all 0.2s ease;
      display: inline-flex;
      align-items: center;
      gap: 4px;
    `;
    btn.setAttribute('title', 'Toggle dark/light mode');
    btn.setAttribute('aria-label', 'Toggle dark mode');
    
    btn.addEventListener('click', () => {
      const isDark = document.documentElement.getAttribute('data-theme') === 'dark';
      applyTheme(isDark ? 'light' : 'dark');
    });
    
    // Insert into nav-actions or header
    const navActions = document.querySelector('.nav-actions');
    if (navActions) {
      navActions.insertAdjacentElement('afterbegin', btn);
    } else {
      const navInner = document.querySelector('.nav-inner');
      if (navInner) {
        const spacer = document.createElement('div');
        spacer.style.cssText = 'display: flex; gap: 12px; align-items: center; margin-left: auto;';
        spacer.appendChild(btn);
        navInner.appendChild(spacer);
      }
    }
  };
  
  // Initialize
  createToggleButton();
  const theme = getSavedTheme();
  applyTheme(theme);
  
});
