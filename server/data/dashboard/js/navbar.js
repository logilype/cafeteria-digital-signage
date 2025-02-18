async function initializeNavbar(currentPageId) {
    try {
        const response = await fetch('/dashboard/config/navbar.json');
        const config = await response.json();
        
        const navbar = document.getElementById('navbar');
        navbar.innerHTML = config.sections.map(section => `
            <div class="navbar-section">
                <div class="navbar-section-title">${section.title}</div>
                ${section.items.map(item => `
                    <div class="navbar-item${item.id === currentPageId ? '-selected' : ''}">
                        <a href="${item.href}" onclick="loadPage('${item.href}', '${item.id}', event)">${item.label}</a>
                    </div>
                `).join('')}
            </div>
        `).join('');
    } catch (error) {
        console.error('Error loading navbar:', error);
    }
}

async function loadPage(href, pageId, event) {
    if (event) {
        event.preventDefault();
    }

    try {
        const response = await fetch(href);
        const html = await response.text();
        
        // Parse the HTML to get only the content div
        const parser = new DOMParser();
        const doc = parser.parseFromString(html, 'text/html');
        const content = doc.querySelector('.content');
        
        // Update the content
        document.querySelector('.content').innerHTML = content.innerHTML;
        
        // Update URL without reload
        window.history.pushState({}, '', href);
        
        // Scroll to top of content
        document.querySelector('.content').scrollTop = 0;
        
        // Update navbar selection
        document.querySelectorAll('.navbar-item, .navbar-item-selected').forEach(item => {
            if (item.querySelector(`a[href="${href}"]`)) {
                item.className = 'navbar-item-selected';
            } else {
                item.className = 'navbar-item';
            }
        });

        // Re-initialize any page-specific scripts
        const scripts = doc.querySelectorAll('script');
        scripts.forEach(script => {
            if (!script.src && script.textContent.includes('DOMContentLoaded')) {
                // Extract and run the initialization code
                const code = script.textContent.replace(
                    /document\.addEventListener\(['"]DOMContentLoaded['"],\s*function\s*\(\)\s*{([\s\S]*?)}\);?/,
                    '$1'
                );
                eval(code);
            }
        });
    } catch (error) {
        console.error('Error loading page:', error);
    }
}

// Handle browser back/forward buttons
window.addEventListener('popstate', () => {
    loadPage(window.location.pathname);
}); 