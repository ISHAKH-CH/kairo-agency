/* ==========================================================================
   KAIRO DESIGN BUREAU — INTERACTIVE FORMS & SCOPE CALCULATOR
   ========================================================================== */

document.addEventListener('DOMContentLoaded', () => {
  // 1. Interactive Project Scope & Budget Calculator
  const calcInputs = document.querySelectorAll('.calc-chip input');
  const calcPriceEl = document.getElementById('calcOutputPrice');
  const calcTimeEl = document.getElementById('calcOutputTime');

  const updateCalculator = () => {
    let basePrice = 5000;
    let baseWeeks = 2;
    let selectedCount = 0;

    calcInputs.forEach(input => {
      if (input.checked) {
        selectedCount++;
        const cost = parseInt(input.getAttribute('data-cost') || '0', 10);
        const time = parseInt(input.getAttribute('data-time') || '0', 10);
        basePrice += cost;
        baseWeeks += time;
      }
    });

    if (selectedCount === 0) {
      if (calcPriceEl) calcPriceEl.textContent = '$5,000 — $10,000';
      if (calcTimeEl) calcTimeEl.textContent = 'Estimated Timeline: 2 - 3 Weeks';
    } else {
      const minPrice = basePrice;
      const maxPrice = Math.round(basePrice * 1.35);
      if (calcPriceEl) {
        calcPriceEl.textContent = `$${minPrice.toLocaleString()} — $${maxPrice.toLocaleString()}`;
      }
      if (calcTimeEl) {
        calcTimeEl.textContent = `Estimated Timeline: ${baseWeeks} - ${baseWeeks + 2} Weeks`;
      }
    }
  };

  calcInputs.forEach(input => {
    input.addEventListener('change', updateCalculator);
  });
  updateCalculator();

  // 2. Budget Range Slider Sync
  const budgetRange = document.getElementById('budgetRange');
  const budgetValueDisplay = document.getElementById('budgetValueDisplay');

  if (budgetRange && budgetValueDisplay) {
    const budgetMap = {
      1: '$10k – $25k (Emerging / Seed)',
      2: '$25k – $50k (Growth / Scale)',
      3: '$50k – $100k (Enterprise / Global)',
      4: '$100k+ (Comprehensive Bureau Retainer)'
    };

    budgetRange.addEventListener('input', (e) => {
      const val = e.target.value;
      budgetValueDisplay.textContent = budgetMap[val] || '$25k – $50k';
    });
  }

  // 3. Contact Form Submission
  const contactForm = document.getElementById('projectInquiryForm');
  if (contactForm) {
    contactForm.addEventListener('submit', (e) => {
      e.preventDefault();
      const submitBtn = contactForm.querySelector('button[type="submit"]');
      const originalText = submitBtn.innerHTML;

      submitBtn.disabled = true;
      submitBtn.innerHTML = `<span>Processing Inquiry...</span>`;

      setTimeout(() => {
        submitBtn.innerHTML = `<span>Inquiry Dispatched Successfully ✓</span>`;
        submitBtn.style.background = '#28a745';
        submitBtn.style.color = '#ffffff';

        showToast('Thank you! Your project brief has been received. A Senior Partner from KAIRO will reach out within 24 hours.');
        contactForm.reset();

        setTimeout(() => {
          submitBtn.disabled = false;
          submitBtn.innerHTML = originalText;
          submitBtn.style.background = '';
          submitBtn.style.color = '';
        }, 4000);
      }, 1200);
    });
  }

  // 4. Newsletter Subscription
  const newsletterForms = document.querySelectorAll('.newsletter-form');
  newsletterForms.forEach(form => {
    form.addEventListener('submit', (e) => {
      e.preventDefault();
      const input = form.querySelector('.newsletter-input');
      if (input && input.value) {
        showToast(`Thank you! ${input.value} is now subscribed to KAIRO Bureau Journal.`);
        input.value = '';
      }
    });
  });

  // Global Toast Notification Helper
  function showToast(message) {
    const existing = document.querySelector('.kairo-toast');
    if (existing) existing.remove();

    const toast = document.createElement('div');
    toast.className = 'kairo-toast';
    toast.style.cssText = `
      position: fixed;
      bottom: 30px;
      right: 30px;
      background: #111118;
      border: 1px solid #e5a93c;
      color: #ffffff;
      padding: 1rem 1.75rem;
      border-radius: 12px;
      font-family: var(--font-body);
      font-size: 0.95rem;
      box-shadow: 0 10px 40px rgba(0,0,0,0.8), 0 0 25px rgba(229,169,60,0.25);
      z-index: 10000;
      transform: translateY(20px);
      opacity: 0;
      transition: all 0.35s ease;
      display: flex;
      align-items: center;
      gap: 0.75rem;
    `;
    toast.innerHTML = `<span style="color: #f5b942; font-size: 1.2rem;">✦</span> <span>${message}</span>`;
    document.body.appendChild(toast);

    setTimeout(() => {
      toast.style.transform = 'translateY(0)';
      toast.style.opacity = '1';
    }, 20);

    setTimeout(() => {
      toast.style.transform = 'translateY(20px)';
      toast.style.opacity = '0';
      setTimeout(() => toast.remove(), 400);
    }, 4500);
  }
});
