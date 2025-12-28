// Tab-specific session manager
// Each tab can have its own user role context independent of other tabs
(function() {
  // Create a unique ID for this tab session
  const TAB_ID = 'tab_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9);
  
  // Store in sessionStorage (cleared when tab is closed, NOT shared across tabs)
  sessionStorage.setItem('tabId', TAB_ID);
  
  console.log('Tab session initialized:', TAB_ID);
  
  // Prevent automatic user context sync from other tabs
  window.addEventListener('storage', (e) => {
    // If another tab tries to change the user context via localStorage, 
    // this tab ignores it (each tab is independent)
    if (e.key === 'globalUserContext') {
      console.log('Note: Another tab changed user context. This tab remains independent.');
      // Don't update this tab's UI based on other tabs' changes
      e.preventDefault?.();
    }
  });
  
  // Add tab ID to fetch requests so server can track which tab made the request
  const originalFetch = window.fetch;
  window.fetch = function(resource, config = {}) {
    // Ensure headers object exists
    if (!config.headers) {
      config.headers = new Headers();
    }
    
    // Add X-Tab-ID header
    if (config.headers instanceof Headers) {
      config.headers.set('X-Tab-ID', TAB_ID);
    } else if (typeof config.headers === 'object') {
      config.headers['X-Tab-ID'] = TAB_ID;
    }
    
    return originalFetch.call(this, resource, config);
  };
  
  // Store tab context on page
  window.tabSessionId = TAB_ID;
  
  // Helper to check if this tab's session is still valid
  window.isTabSessionActive = function() {
    return sessionStorage.getItem('tabId') === TAB_ID;
  };
  
  console.log('Tab session manager loaded. Tab ID:', TAB_ID);
})();

