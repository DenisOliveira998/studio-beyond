# The Artist's Canvas

Build a clean artist exposure platform called The Beyond with the following concept:

Core Concept:
A distraction-free, ad-free space where artists (writers, visual artists, musicians, illustrators, etc.) can publish and showcase their work. The platform monetizes artists through a pay-per-click model combined with a direct donation system.

Monetization Model:

Artists earn revenue based on clicks/views on their content

Readers/appreciators can donate directly to any artist they love

The platform retains a percentage of both click revenue and donations

Key Pages & Features:

Home Feed — discovery feed showing works from various artists (no ads, clean UI)

Artist Profile Page — portfolio-style page with bio, works, total supporters, and a "Support this artist" donation button

Content Page — individual work view (image, text, audio embed, etc.) with like, share, and donate buttons

Dashboard (for artists) — earnings overview showing click revenue, donations received, and platform fee breakdown

Donation Flow — simple modal where readers choose an amount and send directly to the artist

Sign Up / Login — separate flows for Artists and Readers/Supporters

Design Style:

Minimal, elegant, dark or light mode

No banners, no pop-ups, no ads anywhere

Focus on the art — content-first layout

The name "The Beyond" should feel premium and artistic — think editorial, gallery-like

Inspired by Substack + Patreon but cleaner and more visually refined

Tech Notes:

Use a mock revenue/click counter for now

Stripe-ready donation button (UI only, no real payments needed yet)

Responsive for mobile and desktop

This project was built with [Lovable](https://lovable.dev).

**Live app**: https://studio-beyond.lovable.app

## Build with Lovable

Continue developing this project in the [Lovable editor](https://lovable.dev/projects/2cc3c382-3a67-48e1-8821-21ba74d05034).

- **Ship faster**: describe what you want to build and Lovable handles the code.
- **Stay in sync**: every change made in Lovable is committed straight to this repository.
- **Full ownership**: this code is yours. Push to `main` on GitHub and your changes sync back into Lovable, ready for your next prompt.

## Development

Prefer working locally? You need Node.js and npm — [install with nvm](https://github.com/nvm-sh/nvm#installing-and-updating).

```sh
git clone <this-repository-url>
cd <repository-name>
npm i
npm run dev
```
