# KAIRO — Premium Branding & Creative Agency Website

A complete, production-grade, editorial static website built for **KAIRO**, an independent branding and creative studio based in New York, London, and Tokyo.

---

## 🎨 Visual Identity & Creative Direction

- **Brand Statement**: *"We build brands people remember."*
- **Aesthetic**: Luxury editorial design, oversized architectural typography, high-voltage vermilion and cobalt accents on an obsidian foundation, and fluid micro-interactions.
- **Inspiration & Quality**: Built to the interaction standards of leading digital studios (e.g. Wildway reference), with bespoke brand geometry, asymmetric layouts, and kinetic typography.

---

## 📁 Project Structure

```
kairo-agency/
├── index.html            # Flagship Homepage (Hero, Positioning, Work, Services, Process, Manifesto, Testimonials, Inquiries)
├── work.html             # Selected Work Archive with real-time category filtering (08 projects)
├── case-study.html       # Editorial Case Study Deep Dive (AURA HEALTH longevity biotech)
├── about.html            # Agency Ethos, Statistics, Principles, Leadership Team, and Global Studios
├── services.html         # 6 Practice Pillars, Deliverables Breakdown, and Engagement Frameworks
├── contact.html          # Interactive Project Inquiry Builder, Studio Contacts, and FAQ Accordion
├── css/
│   ├── variables.css     # CSS custom properties (color tokens, font scales, cubic-bezier easings)
│   ├── base.css          # CSS reset, typography rules, noise overlay, accessibility focus
│   ├── components.css    # Header, navigation, custom cursor, buttons, project cards, marquee, footer
│   ├── pages.css         # Page-specific editorial layouts (Hero, Case Study, Team, Studios)
│   ├── animations.css    # Keyframes, scroll reveals (IntersectionObserver), reduced-motion fallbacks
│   └── responsive.css   # Responsive adaptations across 1440px+, 1024px, 768px, 480px, and 375px
├── js/
│   ├── main.js           # Live studio clocks (NYC, LDN, TYO), scroll reveal observer, dynamic year
│   ├── navigation.js     # Sticky header backdrop and full-screen mobile menu drawer
│   ├── cursor.js         # Custom desktop magnetic cursor with dynamic text modes ("VIEW", "EXPLORE")
│   ├── interactions.js   # Service row hover media previews, category filtering, testimonial slider, FAQ accordion
│   └── forms.js          # Interactive project brief builder, budget chips, and toast notifications
└── assets/
    ├── icons/            # Bespoke SVG logo mark and UI iconography
    └── images/           # Editorial brand photography and mockups
```

---

## 🚀 Running Locally

The website is pure static HTML5, CSS3, and modern Vanilla JavaScript with zero external runtime build dependencies.

To preview locally:

### Option 1: Python
```bash
cd kairo-agency
python -m http.server 8080
```
Open [http://localhost:8080](http://localhost:8080) in any modern browser.

### Option 2: Node.js (npx serve)
```bash
npx serve .
```

### Option 3: VS Code / IDE Live Server
Right-click `index.html` and select **"Open with Live Server"**.

---

## ✨ Features & Polish

1. **Precision Custom Cursor**: Follower physics that smoothly magnetizes and expands with contextual actions (`VIEW CASE`, `EXPLORE`).
2. **Interactive Service Rows**: Hovering over practice rows displays floating project previews that smoothly follow mouse movements.
3. **Live Multi-City Clocks**: Real-time clocks for New York, London, and Tokyo studios.
4. **Dynamic Work Filter**: Real-time category filtering (`Brand Identity`, `Digital & Web`, `Strategy`, `Campaigns`, `Transformation`) with instant counter recalculation.
5. **Interactive Project Planner**: Contact form with selectable scope chips, budget tiers, and animated validation toasts.
6. **Fully Responsive & Accessible**: Semantic HTML5 hierarchy, WCAG contrast compliance, keyboard navigability, and `@media (prefers-reduced-motion: reduce)` support.
