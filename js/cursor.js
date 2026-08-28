/* ==========================================================================
   KAIRO DESIGN BUREAU — CUSTOM CURSOR & MAGNETIC INTERACTIONS
   ========================================================================== */

document.addEventListener('DOMContentLoaded', () => {
  // Only initialize on desktop devices with fine pointer
  if (window.matchMedia('(pointer: fine)').matches) {
    const dot = document.createElement('div');
    dot.className = 'cursor-dot';

    const follower = document.createElement('div');
    follower.className = 'cursor-follower';

    document.body.appendChild(dot);
    document.body.appendChild(follower);

    let mouseX = 0;
    let mouseY = 0;
    let dotX = 0;
    let dotY = 0;
    let followerX = 0;
    let followerY = 0;

    window.addEventListener('mousemove', (e) => {
      mouseX = e.clientX;
      mouseY = e.clientY;
    });

    // Smooth RAF loop
    const render = () => {
      dotX += (mouseX - dotX) * 0.9;
      dotY += (mouseY - dotY) * 0.9;

      followerX += (mouseX - followerX) * 0.15;
      followerY += (mouseY - followerY) * 0.15;

      dot.style.transform = `translate3d(${dotX}px, ${dotY}px, 0)`;
      follower.style.transform = `translate3d(${followerX}px, ${followerY}px, 0)`;

      requestAnimationFrame(render);
    };
    render();

    // Hover state over interactive elements
    const interactiveElements = document.querySelectorAll('a, button, input, select, textarea, .work-card, .service-card, .calc-chip, .faq-trigger, .team-card');
    
    interactiveElements.forEach(el => {
      el.addEventListener('mouseenter', () => {
        document.body.classList.add('cursor-hover');
      });
      el.addEventListener('mouseleave', () => {
        document.body.classList.remove('cursor-hover');
      });
    });
  }
});
