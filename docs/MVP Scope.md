# MVP Scope

Parent:: [[BJJ Academy App]]

## Must-Have Features

### 1. Core — Class Schedule & Check-in

| Feature | Description |
|---|---|
| Class Schedule | Instructor creates and manages recurring or one-off classes (time, type, instructor) |
| Student Check-in | Students check in to a pre-registered class (simple confirm from their device) |
| Attendance History | Instructor sees who attended each class; students see their own history |

### 4. Business/Admin — Billing & Membership

| Feature | Description |
|---|---|
| Student Registry | Manage student profiles (name, contact, belt, plan type) |
| Payment Tracking | Record manual payments (bank transfer) with date and amount |
| Payment Alerts | Notify students when payment is due or overdue |
| Overdue Dashboard | Instructor sees at a glance who hasn't paid and how long overdue |
| Membership Plans | Define plan types (monthly unlimited, 2x/week, drop-in) with pricing |

### 8.3. Marketplace — Sell Gear

| Feature | Description |
|---|---|
| Product Catalog | Instructor lists products for sale (gi, rashguards, belts) with photos and price |
| Order Requests | Students request/reserve items through the app |
| Order Tracking | Instructor tracks orders and marks as delivered |

> Note: No in-app payment — students pay via manual transfer, same as memberships.

### Gamification

#### Ranking & Points System

The instructor runs a **points-based ranking** where students earn points by placing on the podium at **any** external competition. The ranking system works independently from tournament listings — students can submit results from any competition, whether or not it was posted in the app.

**How it works:**
1. Student competes externally (any competition)
2. Student submits result in the app (competition name, date, podium position)
3. Instructor reviews and **approves or rejects** the submission
4. Alternatively, instructor can **add results manually** on behalf of a student
5. Approved results award points based on the season's configuration

| Feature | Description |
|---|---|
| Season Setup | Instructor defines a time-boxed season (e.g., 6 months, 1 year) with start/end dates |
| Points Configuration | Instructor sets points per podium position (e.g., 1st = 10pts, 2nd = 7pts, 3rd = 5pts) |
| Result Submission | Students submit their competition results (competition name, date, podium position) for instructor approval |
| Instructor Approval | Instructor reviews, approves, or rejects submitted results |
| Manual Entry | Instructor can also add results directly on behalf of a student |
| Belt-Based Rankings (Adults) | Adults (16+) are ranked separately by belt (blue vs blue, brown vs brown, etc.) |
| Single Ranking (Kids) | Kids (under 16) compete in one unified ranking regardless of belt |
| Leaderboard | Live leaderboard per category showing current standings |
| Season Prize | Instructor defines the bonus/prize for the top-ranked student in each category |
| Season History | Archive of past seasons with final standings |

#### Training Engagement

| Feature | Description |
|---|---|
| Training Streaks | Track consecutive training days/weeks. Visible on student profile |
| Achievement Badges | Unlock badges for milestones: "100 Classes," "First Competition," "Submitted an Upper Belt," "Trained Abroad" |
| XP System | Earn XP for attendance, competition results, and logging activity. Separate from belt rank — purely engagement-driven |
| Belt Journey Timeline | Visual timeline showing every milestone, promotion, and stat from white belt onward |

### Tournament Listing (Optional)

Instructor can optionally post upcoming external tournaments for visibility. This is **not required** for the ranking system to work — students can submit results from any competition regardless.

| Feature | Description |
|---|---|
| Tournament Listing | Instructor posts upcoming external tournaments (date, location, federation) |
| Sign-up | Students register interest and select weight class |
| Roster View | Instructor sees who's competing, in which category |

## Student-Facing (Minimal)

Students can:
- View class schedule and check in
- Receive payment due/overdue alerts
- Browse marketplace and request items
- Sign up for tournaments (if posted by instructor)
- Submit competition results for instructor approval (any external competition)
- View leaderboard and their own ranking
- View their streaks, badges, XP, and belt journey timeline

Students **cannot**:
- Create or edit classes
- View other students' payment info
- Manage products or tournaments
- Configure seasons, points, or prizes

## Out of Scope (Nice-to-Have for Later)

- Belt & stripe progression tracking
- Technique journal / sparring log
- Community feed & training partner finder
- Competition prep mode
- AI-powered features
- In-app payments / Stripe integration
- Curriculum planner
- Retention analytics & dashboards
- Revenue analytics (MRR, churn, LTV)
- Lineage tree
- Injury tracker

## Tech Stack

| Layer | Choice |
|---|---|
| Frontend | React + Vite |
| Backend | Fastify (Node.js) |
| Database | PostgreSQL |
| ORM | Drizzle |
| Auth | BetterAuth |
| i18n | react-i18next (pt-BR default, en secondary) |
| Hosting | Railway or Render (free tier) |
| Monorepo | Turborepo |

## Tech Direction

- **Platform**: Web app
- **Multi-tenant**: Yes — built to support multiple academies from the start
- **Offline**: Not required for MVP
- **i18n**: Brazilian Portuguese (pt-BR) as default language, English (en) as secondary option
