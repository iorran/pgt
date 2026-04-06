# Data Model

Parent:: [[BJJ Academy App]] | [[MVP Scope]]

## ER Diagram

```mermaid
erDiagram
    Academy ||--o{ User : has
    Academy ||--o{ Class : offers
    Academy ||--o{ MembershipPlan : defines
    Academy ||--o{ Product : sells
    Academy ||--o{ Season : runs
    Academy ||--o{ Tournament : lists

    User ||--o{ Checkin : "checks in"
    User ||--o{ StudentMembership : subscribes
    User ||--o{ Payment : pays
    User ||--o{ Order : places
    User ||--o{ CompetitionResult : submits
    User ||--o{ TournamentSignup : "signs up"
    User ||--o{ StudentBadge : earns
    User ||--o{ XPEntry : earns

    Class ||--o{ Checkin : records
    MembershipPlan ||--o{ StudentMembership : "used by"
    Product ||--o{ Order : "ordered as"
    Season ||--o{ CompetitionResult : contains
    Tournament ||--o{ TournamentSignup : has
    BadgeDefinition ||--o{ StudentBadge : "awarded as"

    Academy {
        uuid id PK
        string name
        string slug UK
        string logo_url
        timestamp created_at
    }

    User {
        uuid id PK
        uuid academy_id FK
        string email UK
        string name
        string phone
        date date_of_birth
        enum belt "white|blue|purple|brown|black"
        enum role "instructor|student"
        timestamp created_at
    }

    Class {
        uuid id PK
        uuid academy_id FK
        uuid instructor_id FK
        string name
        string type "gi|no-gi|open-mat|kids"
        enum recurrence "once|weekly"
        int day_of_week "0-6 for weekly"
        date date "for one-off classes"
        time start_time
        time end_time
        boolean active
    }

    Checkin {
        uuid id PK
        uuid class_id FK
        uuid student_id FK
        timestamp checked_in_at
    }

    MembershipPlan {
        uuid id PK
        uuid academy_id FK
        string name
        decimal price
        enum frequency "monthly|quarterly|yearly"
        int classes_per_week "null = unlimited"
        boolean active
    }

    StudentMembership {
        uuid id PK
        uuid student_id FK
        uuid plan_id FK
        date start_date
        int due_day "day of month payment is due"
        boolean active
    }

    Payment {
        uuid id PK
        uuid student_id FK
        uuid academy_id FK
        decimal amount
        date payment_date
        string reference_month "e.g. 2026-04"
        uuid recorded_by FK "instructor who logged it"
        timestamp created_at
    }

    Product {
        uuid id PK
        uuid academy_id FK
        string name
        string description
        decimal price
        string photo_url
        int stock
        boolean active
    }

    Order {
        uuid id PK
        uuid product_id FK
        uuid student_id FK
        int quantity
        enum status "requested|confirmed|delivered|cancelled"
        timestamp created_at
        timestamp updated_at
    }

    Season {
        uuid id PK
        uuid academy_id FK
        string name
        date start_date
        date end_date
        jsonb points_config "e.g. {1: 10, 2: 7, 3: 5}"
        string prize_description
        boolean active
    }

    CompetitionResult {
        uuid id PK
        uuid season_id FK
        uuid student_id FK
        string competition_name
        date competition_date
        int position "1, 2, or 3"
        int points_awarded
        enum status "pending|approved|rejected"
        uuid submitted_by FK
        uuid reviewed_by FK "instructor who approved/rejected"
        timestamp created_at
    }

    Tournament {
        uuid id PK
        uuid academy_id FK
        string name
        date date
        string location
        string federation
        timestamp created_at
    }

    TournamentSignup {
        uuid id PK
        uuid tournament_id FK
        uuid student_id FK
        string weight_class
        timestamp created_at
    }

    BadgeDefinition {
        uuid id PK
        uuid academy_id FK
        string name
        string description
        string icon
        string criteria_type "classes_count|first_competition|etc"
        int criteria_value
    }

    StudentBadge {
        uuid id PK
        uuid student_id FK
        uuid badge_definition_id FK
        timestamp earned_at
    }

    XPEntry {
        uuid id PK
        uuid student_id FK
        int xp_amount
        string source_type "checkin|competition|badge"
        uuid source_id "FK to the triggering record"
        timestamp earned_at
    }

    Streak {
        uuid id PK
        uuid student_id FK
        int current_streak "consecutive weeks"
        int longest_streak "all-time best"
        date last_checkin_week "ISO week of last check-in"
        timestamp updated_at
    }

    User ||--|| Streak : has
```

## Key Design Decisions

### Multi-tenancy
- **Academy** is the tenant. Every entity belongs to an academy.
- Users are scoped to a single academy (for MVP). Cross-academy support can come later.

### Kid vs Adult for Rankings
- Derived from `User.date_of_birth` — a kid is anyone under 16 years old.
- No need for a separate field; the app calculates it at query time.
- Belt-based ranking categories for adults, single unified ranking for kids.

### Competition Results — Approval Flow
- Student submits → `status: pending`
- Instructor approves → `status: approved`, `points_awarded` calculated from `Season.points_config`
- Instructor rejects → `status: rejected`
- Instructor can also create results directly (`submitted_by = reviewed_by = instructor`)

### Payments — Manual Only
- Instructor records payments manually (no Stripe/gateway).
- `reference_month` tracks which month the payment covers (e.g., "2026-04").
- `due_day` on StudentMembership defines when the alert fires each month.

### Streaks
- Persisted in a `Streak` table — one row per student.
- `current_streak` increments each week the student checks in at least once; resets to 0 if a week is missed.
- `longest_streak` stores the all-time best so it's never lost.
- `last_checkin_week` tracks the last active week to detect gaps.
- Updated whenever a check-in is recorded.

### XP
- Flat log table. Total XP = `SUM(xp_amount)` per student.
- `source_type` + `source_id` links back to what earned the XP (a check-in, competition result, etc).

## Indexes to Consider

- `checkin(student_id, checked_in_at)` — streak calculations
- `checkin(class_id)` — attendance per class
- `payment(student_id, reference_month)` — overdue checks
- `competition_result(season_id, student_id, status)` — leaderboard queries
- `user(academy_id, role)` — listing students/instructors
