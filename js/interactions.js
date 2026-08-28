/**
 * KAIRO - Interactive Features (Service Previews, Filtering, Testimonials, FAQ)
 */
document.addEventListener('DOMContentLoaded', () => {
  initServiceHoverPreviews();
  initWorkFilters();
  initTestimonialSlider();
  initFaqAccordion();
});

/* Floating Service Row Hover Previews */
function initServiceHoverPreviews() {
  const serviceRows = document.querySelectorAll('.service-row[data-preview-img]');
  if (!serviceRows.length || window.matchMedia('(pointer: coarse)').matches) return;

  // Create preview container
  const previewBox = document.createElement('div');
  previewBox.className = 'service-preview-container';
  const previewImg = document.createElement('img');
  previewImg.alt = 'Service Preview';
  previewBox.appendChild(previewImg);
  document.body.appendChild(previewBox);

  let targetX = 0;
  let targetY = 0;
  let currentX = 0;
  let currentY = 0;
  let isHovering = false;

  window.addEventListener('mousemove', (e) => {
    targetX = e.clientX + 30;
    targetY = e.clientY + 20;
  });

  function updatePreviewPosition() {
    if (isHovering) {
      currentX += (targetX - currentX) * 0.15;
      currentY += (targetY - currentY) * 0.15;
      previewBox.style.left = `${currentX}px`;
      previewBox.style.top = `${currentY}px`;
    }
    requestAnimationFrame(updatePreviewPosition);
  }
  requestAnimationFrame(updatePreviewPosition);

  serviceRows.forEach(row => {
    const imgSrc = row.getAttribute('data-preview-img');
    row.addEventListener('mouseenter', () => {
      if (imgSrc) {
        previewImg.src = imgSrc;
        previewBox.style.opacity = '1';
        previewBox.style.transform = 'translate(-50%, -50%) scale(1)';
        isHovering = true;
      }
    });

    row.addEventListener('mouseleave', () => {
      previewBox.style.opacity = '0';
      previewBox.style.transform = 'translate(-50%, -50%) scale(0.85)';
      isHovering = false;
    });
  });
}

/* Portfolio Category Filter */
function initWorkFilters() {
  const filterPills = document.querySelectorAll('.filter-pill');
  const projectCards = document.querySelectorAll('.project-card[data-category]');
  const countDisplay = document.getElementById('projectCount');

  if (!filterPills.length || !projectCards.length) return;

  filterPills.forEach(pill => {
    pill.addEventListener('click', () => {
      filterPills.forEach(p => p.classList.remove('active'));
      pill.classList.add('active');

      const filter = pill.getAttribute('data-filter');
      let visibleCount = 0;

      projectCards.forEach(card => {
        const categories = card.getAttribute('data-category').split(' ');
        if (filter === 'all' || categories.includes(filter)) {
          card.style.display = 'flex';
          card.style.opacity = '0';
          setTimeout(() => {
            card.style.opacity = '1';
          }, 50);
          visibleCount++;
        } else {
          card.style.display = 'none';
        }
      });

      if (countDisplay) {
        countDisplay.textContent = `(${String(visibleCount).padStart(2, '0')})`;
      }
    });
  });
}

/* Testimonial Slider */
function initTestimonialSlider() {
  const testimonials = [
    {
      quote: "“KAIRO took our complex technical vision and distilled it into an iconic brand identity that fundamentally repositioned us in the global market.”",
      author: "Elena Rostova",
      role: "Founder & CEO, AURA HEALTH",
      initials: "ER"
    },
    {
      quote: "“The clarity, rigor, and unapologetic creativity that KAIRO brought to our launch helped us secure our $45M Series B in record time.”",
      author: "Marcus Vance",
      role: "Chief Marketing Officer, NEO MOBILITY",
      initials: "MV"
    },
    {
      quote: "“Working with KAIRO wasn’t just a redesign; it was a profound shift in how our customers perceive our value proposition.”",
      author: "Sora Takahashi",
      role: "Creative Director, CHRONOS HOROLOGY",
      initials: "ST"
    }
  ];

  let currentIndex = 0;
  const quoteEl = document.querySelector('.testimonial-quote');
  const authorEl = document.querySelector('.author-name');
  const roleEl = document.querySelector('.author-role');
  const avatarEl = document.querySelector('.author-avatar');
  const prevBtn = document.getElementById('testPrevBtn');
  const nextBtn = document.getElementById('testNextBtn');

  if (!quoteEl || !prevBtn || !nextBtn) return;

  function renderTestimonial(index) {
    quoteEl.style.opacity = '0';
    quoteEl.style.transform = 'translateY(10px)';

    setTimeout(() => {
      const item = testimonials[index];
      quoteEl.textContent = item.quote;
      if (authorEl) authorEl.textContent = item.author;
      if (roleEl) roleEl.textContent = item.role;
      if (avatarEl) avatarEl.textContent = item.initials;

      quoteEl.style.opacity = '1';
      quoteEl.style.transform = 'translateY(0)';
    }, 200);
  }

  prevBtn.addEventListener('click', () => {
    currentIndex = (currentIndex - 1 + testimonials.length) % testimonials.length;
    renderTestimonial(currentIndex);
  });

  nextBtn.addEventListener('click', () => {
    currentIndex = (currentIndex + 1) % testimonials.length;
    renderTestimonial(currentIndex);
  });
}

/* FAQ Accordion */
function initFaqAccordion() {
  const faqHeaders = document.querySelectorAll('.faq-header');
  if (!faqHeaders.length) return;

  faqHeaders.forEach(header => {
    header.addEventListener('click', () => {
      const item = header.closest('.faq-item');
      const isOpen = item.classList.contains('active');

      // Close other items
      document.querySelectorAll('.faq-item').forEach(other => {
        if (other !== item) other.classList.remove('active');
      });

      item.classList.toggle('active', !isOpen);
    });
  });
}
