# ASTROT - Soulful Astrology App

## 🌌 Concept & Vision
Astrot is not just a calculator; it is a "Soulful Best Friend."
The core philosophy moves beyond static data into a **Living, Breathing Entity** that evolves with the user.

---

## 🧠 4-Layer Personalization System

### Layer 1: The Base (Static)
*   **Input:** Birth Date, Time, Place.
*   **Output:** Natal Chart, Element, Three Keys (Hook).
*   **Goal:** Establish authority and identity.

### Layer 2: Behavioral Patterns (Dynamic)
*   **Input:** Frequency of login, preferred sections (Love vs. Career).
*   **Output:** Reordering dashboard buttons, "We noticed you care about..." prompts.
*   **Goal:** Reduce friction, increase relevance.

### Layer 3: Emotional & Contextual (Momentary)
*   **Input:** Current Weather (API), News Trends (API), Text Sentiment Analysis.
*   **Output:** "It's raining and Moon is in Pisces — perfect for tea and journaling."
*   **Goal:** Create a "Wow" factor. The app knows *where* and *how* you are.

### Layer 4: Evolutionary (Long-term)
*   **Input:** Time spent, depth of queries, premium duration.
*   **Output:** "Soul Level" growth. "Your Confidence score increased by 27% this month."
*   **Goal:** Gamification of spiritual growth. Retention.

---

## 🔮 The "Mystical Funnel" (User Flow)

1.  **Onboarding:** Name/Date/Place.
2.  **The Hook (Free):** Interactive "Manifestation" of 3 Personality Keys.
3.  **The Cliffhanger (CTA):** "This is only 10%..."
4.  **The Paywall:** Weekly Subscription (Telegram Stars).
5.  **Premium Hub:**
    *   **Cosmic Passport:** Dynamic header.
    *   **Soul Evolution:** Progress bars (Confidence, Intuition).
    *   **Context Card:** Weather + Transit integration.
    *   **Full Analysis:** Deep dives into 5 Pillars.
    *   **Synastry:** Compatibility.

---

## 🛠 Technical Roadmap (Optimization)

1.  **Context API:** Integrate OpenWeatherMap & NewsAPI for real-time context.
2.  **Incremental Context:** Summarize previous context into a "User State" object to optimize API calls.
3.  **Batch Processing:** Generate Daily Horoscopes at 00:01 UTC via Cron Jobs (Cloud Functions) rather than on-demand to reduce latency.
4.  **Database:** All data is stored in Replit Database via DATABASE_URL environment variable.
