## Design System: AirWise

### Pattern
- **Name:** Hero-Centric Design
- **Conversion Focus:** One primary CTA. Let the hero dominate the initial viewport without hiding the next content cue. Use a static hero and non-pulsing CTA when reduced motion is requested; provide video controls. Pause hero media offscreen/hidden and keep the final hero message and CTA static under reduced motion.
- **CTA Placement:** Hero dominant (center/bottom) + Sticky nav CTA
- **Color Strategy:** Hero: High-impact visual. Minimal text. Verify CTA label text against the button fill at 4.5:1 minimum; use 7:1 only for an explicit AAA normal-text target.
- **Sections:** Full-bleed Hero (headline + visual) > Single value prop strip > Key benefit or proof > Primary CTA

### Style
- **Name:** Glassmorphism
- **Mode Support:** Light supported | Dark supported
- **Keywords:** Frosted glass, transparent, blurred background, layered, vibrant background, light source, depth, multi-layer
- **Best For:** Modern SaaS, financial dashboards, high-end corporate, lifestyle apps, modal overlays, navigation
- **Performance:** cost:low|drivers:none | **Accessibility:** risk:conditional|requires:contrast-text-4.5,keyboard,visible-focus,reduced-motion

### Colors
| Role | Hex | CSS Variable |
|------|-----|--------------|
| Primary | `#0284C7` | `--color-primary` |
| On Primary | `#000000` | `--color-on-primary` |
| Secondary | `#0EA5E9` | `--color-secondary` |
| On Secondary | `#000000` | `--color-on-secondary` |
| Accent/CTA | `#F59E0B` | `--color-accent` |
| On Accent/CTA | `#0F172A` | `--color-on-accent` |
| Background | `#F0F9FF` | `--color-background` |
| Foreground | `#0F172A` | `--color-foreground` |
| Card | `#FFFFFF` | `--color-card` |
| Card Foreground | `#0F172A` | `--color-card-foreground` |
| Muted | `#EFF7FB` | `--color-muted` |
| Muted Foreground | `#475569` | `--color-muted-foreground` |
| Border | `#E0F0F8` | `--color-border` |
| Destructive | `#DC2626` | `--color-destructive` |
| On Destructive | `#FFFFFF` | `--color-on-destructive` |
| Ring | `#0284C7` | `--color-ring` |

*Notes: Sky blue + sun amber*

### Typography
- **Heading:** Lora
- **Body:** Raleway
- **Mood:** calm, wellness, health, relaxing, natural, organic
- **Best For:** Health apps, wellness, spa, meditation, yoga, organic brands
- **Google Fonts:** https://fonts.googleapis.com/css2?family=Lora:wght@400;500;600;700&family=Raleway:wght@300;400;500;600;700&display=swap
- **CSS Import:**
```css
@import url('https://fonts.googleapis.com/css2?family=Lora:wght@400;500;600;700&family=Raleway:wght@300;400;500;600;700&display=swap');
```

### Key Effects
Backdrop blur (10-20px), subtle border (1px solid rgba white 0.2), light reflection, Z-depth

### Avoid (Anti-patterns)
- Inconsistent styling
- Poor contrast ratios

### Pre-Delivery Checklist
- [ ] No emojis as icons (use SVG: Heroicons/Lucide)
- [ ] cursor-pointer on all clickable elements
- [ ] Hover states with smooth transitions (150-300ms)
- [ ] Light mode: text contrast 4.5:1 minimum
- [ ] Focus states visible for keyboard nav
- [ ] prefers-reduced-motion respected
- [ ] Responsive: 375px, 768px, 1024px, 1440px


---
## AirWise adaptations (applied)
- Primary buttons use `#0369A1` (sky-700) with white text: 5.9:1. Generator's `#0284C7` + black text kept only for accents.
- Glassmorphism limited to sidebar, top bar and hero; content cards are solid white for 4.5:1 text contrast.
- Layout: dashboard shell with side menu, one view per menu item (no long scrolling page).
- Icons: Phosphor (`@phosphor-icons/react`), decorative icons `aria-hidden`.
- Chart: solid PM2.5 line, dashed AQI line, plus a table view (a11y fallback).
