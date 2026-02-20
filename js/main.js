// ===== Scroll fade-in animations =====
const observer = new IntersectionObserver((entries) => {
    entries.forEach(entry => {
        if (entry.isIntersecting) {
            entry.target.classList.add('visible');
        }
    });
}, { threshold: 0.1 });

document.querySelectorAll('.fade-in').forEach(el => observer.observe(el));

// ===== Mobile nav toggle =====
const toggle = document.querySelector('.nav-toggle');
const navLinks = document.querySelector('.nav-links');

if (toggle) {
    toggle.addEventListener('click', () => {
        navLinks.classList.toggle('open');
    });

    // Close menu when a link is clicked
    navLinks.querySelectorAll('a').forEach(link => {
        link.addEventListener('click', () => {
            navLinks.classList.remove('open');
        });
    });
}

// ===== Navbar background on scroll =====
const navbar = document.querySelector('.navbar');

// ===== Scroll indicator =====
const scrollIndicator = document.getElementById('scroll-indicator');

window.addEventListener('scroll', () => {
    if (window.scrollY > 50) {
        navbar.style.borderBottomColor = 'rgba(96, 165, 250, 0.15)';
    } else {
        navbar.style.borderBottomColor = '';
    }

    // Hide scroll indicator after scrolling
    if (scrollIndicator) {
        if (window.scrollY > 100) {
            scrollIndicator.classList.add('hidden');
        } else {
            scrollIndicator.classList.remove('hidden');
        }
    }
});

if (scrollIndicator) {
    scrollIndicator.addEventListener('click', () => {
        window.scrollBy({ top: window.innerHeight * 0.85, behavior: 'smooth' });
    });
}
