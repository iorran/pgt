# Brainstorm

Parent:: [[BJJ Academy App]]

Full brainstorm of ideas for the BJJ Academy App. Items marked with **MVP** are included in the [[MVP Scope]].

## 1. Core Features **MVP**

- **Class Schedule & Check-in** — Real-time schedule with push notifications; QR/NFC check-in at the mat
- **Belt & Stripe Tracker** — Visual progression timeline from white to black; one-tap promotions by instructors
- **Attendance Heatmap** — GitHub-style calendar showing training consistency over months/years
- **Digital Onboarding** — Waiver signing, gi size, emergency contacts — all before day one

## 2. Student Experience

- **Technique Journal** — Log techniques per class with tags (guard, pass, sweep, submission) and personal notes
- **Sparring Log** — Record rolls: partner, what worked/didn't. Surfaces patterns over time
- **Personal Game Plan** — Visual flowchart of your A-game: favorite guard, go-to passes, submission chains
- **Goal Setting** — "Train 4x/week," "Compete by June" with progress bars and nudges
- **Video Bookmarks** — Save timestamped links to technique videos, organized by position

## 3. Instructor/Coach Tools

- **Curriculum Planner** — Map weekly/monthly themes with drag-and-drop lesson builder
- **Student Notes** — Private notes per student: injuries, learning pace, promotion readiness
- **Promotion Checklist** — Configurable requirements per belt (min. classes, competition, techniques demonstrated)
- **Class Recap** — Quick post-class form that auto-feeds into student journals

## 4. Business/Admin **MVP**

- **Billing & Memberships** — Stripe integration, plan tiers, automated failed-payment recovery
- **Retention Dashboard** — Flag dropping attendance; trigger "we miss you" messages at 7/14/30 day gaps
- **Revenue Analytics** — MRR, churn, LTV, trial-to-paid conversion
- **Trial Pipeline** — Sign-up > first class > follow-up sequence > conversion tracking

## 5. Community & Social

- **Academy Feed** — Announcements, belt promotions, competition results, open mat reminders
- **Training Partner Finder** — Filter by weight, belt, availability
- **Competition Team Board** — Tournament sign-ups, weight class coordination, carpool logistics
- **Inter-Academy Challenges** — Aggregate attendance/medals across affiliated schools

## 6. Gamification

- **Competition Ranking System** — Time-boxed seasons where students earn points for podium placements at external competitions. Ranked by belt (adults) or unified (kids under 16). Season winner gets a prize set by the instructor. **MVP**
- **Training Streaks** — Duolingo-style streaks with freeze tokens
- **Achievement Badges** — "100 Classes," "First Comp," "Submitted an Upper Belt," "Trained Abroad"
- **XP System** — Earn XP for attendance, competition, journaling (separate from belt rank)
- **Belt Journey Timeline** — Visual scroll of every milestone and promotion photo from white belt onward

## 7. BJJ-Specific Differentiators

- **Position Taxonomy** — Structured hierarchy: Position > Variation > Technique > Details
- **Competition Prep Mode** — IBJJF/ADCC rules reference, weight cut tracker, bracket simulator
- **Injury Tracker** — Body-map UI to log injuries; coaches see limitations
- **Lineage Tree** — Visual instructor lineage back to the founders

## 8. Monetization

- **SaaS per Academy** — Monthly fee tiered by student count (primary model)
- **Premium Student Tier** — Advanced analytics, video storage, game plan builder
- **Marketplace** — Gi/rashguard sales via affiliate partnerships **MVP**
- **Tournament Listing** — Post external tournaments, manage sign-ups and roster **MVP**

## 9. Tech Considerations

- **Cross-platform** — React Native or Flutter for iOS/Android
- **Offline-first** — Sync when back online (gyms often have poor signal)
- **Integrations** — Smoothcomp, Google Calendar, Stripe, WhatsApp
- **Multi-tenant** — Single backend serving many academies with data isolation

## 10. Wild/Innovative Ideas

- **AI Technique Recommender** — Analyze sparring log weaknesses, suggest drills to study
- **Video Roll Review** — Upload sparring footage; AI timestamps position changes and submissions
- **AR Drilling Overlay** — See footwork/angle guides overlaid on the mat
- **"What Would You Do?" Puzzles** — Daily positional scenarios (chess puzzles for BJJ)
- **Smartwatch Rolling Timer** — Haptic vibrations for round start/end — no buzzer needed
