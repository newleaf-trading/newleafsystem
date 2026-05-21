/**
 * NewLeaf Pro Navigation Loader
 * Include this script in the <head> of every page
 * Usage: <script src="load-nav.js"></script>
 */

(async function() {
  try {
    const response = await fetch('nav-component.html');
    const navHTML = await response.text();
    
    // Create a temporary container to parse the HTML
    const temp = document.createElement('div');
    temp.innerHTML = navHTML;
    
    // Extract and insert the nav element
    const nav = temp.querySelector('nav');
    if (nav) {
      document.body.insertBefore(nav, document.body.firstChild);
    }
    
    // Extract and insert styles
    const styles = temp.querySelectorAll('style');
    styles.forEach(style => {
      document.head.appendChild(style.cloneNode(true));
    });
    
    // Extract and execute scripts (preserve type="module" for ES module imports)
    const scripts = temp.querySelectorAll('script');
    scripts.forEach(oldScript => {
      const newScript = document.createElement('script');
      if (oldScript.type) newScript.type = oldScript.type;
      newScript.textContent = oldScript.textContent;
      document.body.appendChild(newScript);
    });
    
  } catch (error) {
    console.error('Failed to load navigation:', error);
  }
})();
