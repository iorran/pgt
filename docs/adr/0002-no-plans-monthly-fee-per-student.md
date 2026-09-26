---
title: "ADR 0002: No plans — the Owner sets each Student's Monthly Fee"
tags:
  - adr
  - billing
date: 2026-09-26
---

# No plans — the Owner sets each Student's Monthly Fee

The academy has a price list (1 modality 45 €, 2 modalities 65 €, trânsito livre 60 €, kids 35 €, family = per person), but the Owner wants to set every Student's [[CONTEXT#Monthly Fee|Monthly Fee]] himself rather than have plans enforce it, and to record what each Student trains as [[CONTEXT#Modality|Modalities]] plus a free Training Note. We therefore removed membership plans (and the per-student "agreed price" override that only existed to deviate from them): a Student's fee is a single number the Owner types, with the usual amounts offered as one-tap suggestions. Existing students keep their current price as their Monthly Fee. Trade-off: the app can no longer derive or audit prices from what a Student trains — that is the Owner's call, as it already was in the spreadsheet.

Supersedes the Plan / Agreed Price decisions in [[2026-09-26-families-design|Families design]].
