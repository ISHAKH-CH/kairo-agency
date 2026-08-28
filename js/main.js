/* ==========================================================================
   KAIRO DESIGN BUREAU — MAIN APPLICATION CONTROLLER
   ========================================================================== */

console.log(
  '%c KAIRO DESIGN BUREAU %c Brands with Purpose. Designed for Impact. ',
  'background: #e5a93c; color: #000; font-weight: bold; padding: 4px 8px; border-radius: 4px;',
  'background: #09090c; color: #f5b942; padding: 4px 8px; border-radius: 4px;'
);

document.addEventListener('DOMContentLoaded', () => {
  // Smooth scroll for anchor links
  document.querySelectorAll('a[href^="#"]').forEach(anchor => {
    anchor.addEventListener('click', function(e) {
      const targetId = this.getAttribute('href');
      if (targetId && targetId !== '#') {
        const targetElement = document.querySelector(targetId);
        if (targetElement) {
          e.preventDefault();
          targetElement.scrollIntoView({ behavior: 'smooth' });
        }
      }
    });
  });
});
