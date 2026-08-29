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

  // 3. Contact Form Submission (Live FormSubmit Endpoint)
  const contactForm = document.getElementById('projectInquiryForm');
  if (contactForm) {
    contactForm.addEventListener('submit', async (e) => {
      e.preventDefault();
      const submitBtn = contactForm.querySelector('button[type="submit"]');
      const originalText = submitBtn.innerHTML;

      // Extract form values
      const name = document.getElementById('clientName')?.value || '';
      const company = document.getElementById('companyName')?.value || '';
      const email = document.getElementById('clientEmail')?.value || '';
      const phone = document.getElementById('clientPhone')?.value || '';
      const website = document.getElementById('clientWebsite')?.value || 'Not provided';
      const industry = document.getElementById('industrySelect')?.value || 'Not specified';
      const timeline = document.getElementById('timelineSelect')?.value || 'Quarter';
      const message = document.getElementById('projectDescription')?.value || '';
      const budgetDisplay = document.getElementById('budgetValueDisplay')?.textContent || '$25k – $50k';

      // Checked services
      const selectedServices = [];
      document.querySelectorAll('input[name="services"]:checked').forEach(cb => {
        selectedServices.push(cb.value);
      });

      const payload = {
        name: name,
        company: company,
        email: email,
        phone: phone,
        website: website,
        industry: industry,
        services: selectedServices.length > 0 ? selectedServices.join(', ') : 'None selected',
        estimated_budget: budgetDisplay,
        timeline: timeline,
        message: message,
        _subject: `New KAIRO Project Brief: ${name} (${company})`,
        _template: 'table',
        _captcha: 'false'
      };

      submitBtn.disabled = true;
      submitBtn.innerHTML = `<span>Dispatching Brief to Partners...</span>`;

      try {
        const response = await fetch('https://formsubmit.co/ajax/contact@kairodesigns.org', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Accept': 'application/json'
          },
          body: JSON.stringify(payload)
        });

        const data = await response.json();

        if (response.ok || data.success === "true" || data.message) {
          submitBtn.innerHTML = `<span>Brief Dispatched Successfully ✓</span>`;
          submitBtn.style.background = '#28a745';
          submitBtn.style.color = '#ffffff';

          showToast('Thank you! Your project brief has been sent directly to contact@kairodesigns.org. A Senior Partner will reach out within 24 hours.');
          contactForm.reset();

          setTimeout(() => {
            submitBtn.disabled = false;
            submitBtn.innerHTML = originalText;
            submitBtn.style.background = '';
            submitBtn.style.color = '';
          }, 4500);
        } else {
          throw new Error(data.message || 'Submission failed');
        }
      } catch (err) {
        console.error('Submission error:', err);
        submitBtn.disabled = false;
        submitBtn.innerHTML = originalText;
        showToast('Inquiry could not be dispatched automatically. Please contact us directly at contact@kairodesigns.org');
      }
    });
  }

  // 4. Newsletter Subscription (Live FormSubmit Endpoint)
  const newsletterForms = document.querySelectorAll('.newsletter-form');
  newsletterForms.forEach(form => {
    form.addEventListener('submit', async (e) => {
      e.preventDefault();
      const input = form.querySelector('.newsletter-input');
      const submitBtn = form.querySelector('button[type="submit"]');
      if (!input || !input.value) return;

      const email = input.value;
      const originalBtnText = submitBtn ? submitBtn.textContent : 'Join';
      if (submitBtn) {
        submitBtn.disabled = true;
        submitBtn.textContent = '...';
      }

      try {
        await fetch('https://formsubmit.co/ajax/contact@kairodesigns.org', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Accept': 'application/json'
          },
          body: JSON.stringify({
            email: email,
            _subject: `New KAIRO Bureau Journal Subscriber: ${email}`,
            _template: 'table',
            _captcha: 'false'
          })
        });

        showToast(`Thank you! ${email} is now subscribed to KAIRO Bureau Journal.`);
        input.value = '';
      } catch (err) {
        showToast(`Thank you! ${email} has been registered.`);
        input.value = '';
      } finally {
        if (submitBtn) {
          submitBtn.disabled = false;
          submitBtn.textContent = originalBtnText;
        }
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
