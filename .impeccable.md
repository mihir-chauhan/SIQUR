## Design Context

### Users
Hackathon judges evaluating innovation, execution, and wow factor. They see dozens of projects in a day. The interface needs to immediately communicate "this is different" and hold attention through the demo flow (globe > building > camera > simulation).

### Brand Personality
**Tactical. Precise. Elite.**

This is a classified intelligence system, not a consumer app. Every element should feel like it belongs in a SCIF or mission control center. Language is terse, military-coded. Nothing is casual or decorative without purpose.

### Aesthetic Direction
- **Theme:** Dark only. Pure black (#0a0a0a) backgrounds. No light mode.
- **Primary accent:** Cyan (#00e5ff) for interactive elements, data, HUD chrome
- **Secondary accent:** Green (#00ff41) for status indicators, night-vision feel, confirmation states
- **Typography:** Space Mono for all data readouts, coordinates, labels. Inter for UI body text.
- **Effects:** Scanline overlay, glow effects (text-shadow), flicker animation, corner brackets on containers, classification banners ("TOP SECRET", "EYES ONLY")
- **Reference:** Bilawal Sidhu's WorldView geospatial dashboard (spy-thriller intelligence HUD with NVG mode, FLIR filters, monospace readouts, tactical layout)
- **Anti-references:** Anything toy, playful, colorful, rounded, gradient-heavy, or consumer-app feeling. No shadcn defaults. No friendly UI. No emojis in the interface.

### Design Principles
1. **Every pixel is intentional.** No decorative filler. If it's on screen, it communicates something.
2. **Information density over whitespace.** This is a command center, not a landing page. Data should feel rich but organized.
3. **Motion clarifies, never decorates.** Transitions show spatial relationships (globe zoom > building > camera). Loading states use military language ("ESTABLISHING SATELLITE LINK", "OPTIMIZING PLACEMENT").
4. **The UI is the demo.** Judges should feel like they're using classified technology. The aesthetic IS the product differentiator.
5. **Monospace is the default voice.** All labels, readouts, and status text use monospace. Sans-serif is reserved for longer descriptions only.
