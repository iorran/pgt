## [1.3.1](https://github.com/iorran/pgt/compare/v1.3.0...v1.3.1) (2026-04-09)


### Bug Fixes

* **e2e:** use crypto.randomBytes for academy slug and joinCode ([24114e0](https://github.com/iorran/pgt/commit/24114e0a0d0f02fa932879f5d6b0de76bc9e30ca))

# [1.3.0](https://github.com/iorran/pgt/compare/v1.2.1...v1.3.0) (2026-04-09)


### Bug Fixes

* **api:** sign dev impersonate cookie with BetterAuth HMAC format ([e253d87](https://github.com/iorran/pgt/commit/e253d87631e60a6c027715ab26b014fdb2930819))
* **scripts:** route dev impersonate through Vite proxy, relax wait ([5ce228a](https://github.com/iorran/pgt/commit/5ce228a0963acbdcce6953449999af28b9a2d2af))


### Features

* **api:** add currently-running class to guide seed ([529801d](https://github.com/iorran/pgt/commit/529801d56a0d575f346900027008c2046b51fd5e))
* **api:** add dev-only auth impersonation endpoint ([343609a](https://github.com/iorran/pgt/commit/343609a0e524aebd3192194ac5d39994401f1df2))
* **api:** add seed-guide script for documentation fixtures ([c7c5246](https://github.com/iorran/pgt/commit/c7c5246d7db4fcaa64f08c19304e0810912d8eeb))

## [1.2.1](https://github.com/iorran/pgt/compare/v1.2.0...v1.2.1) (2026-04-09)


### Bug Fixes

* **i18n:** add missing billing.week key ([07c0554](https://github.com/iorran/pgt/commit/07c0554b06cae1e39252ba092ecca02fff5673a4))
* **i18n:** restore missing accents in pt-BR onboarding strings ([c71e484](https://github.com/iorran/pgt/commit/c71e484247361b56b08f27b4ba9e9f2d63aa7463))
* **web:** use i18n for settings geolocation error ([94e2197](https://github.com/iorran/pgt/commit/94e2197ebb6dc3e7b1fcbccf934f7c3430dd6a70))
* **web:** use proper dashboard greeting key instead of loading string ([26948d2](https://github.com/iorran/pgt/commit/26948d29227eea36079a1d71a2904e9c01af1c2b))

# [1.2.0](https://github.com/iorran/pgt/compare/v1.1.1...v1.2.0) (2026-04-09)


### Features

* multi-month overdue detection and quick pay current month button ([2b58571](https://github.com/iorran/pgt/commit/2b58571ce394de3821b8081b23640692446a5fd2))

## [1.1.1](https://github.com/iorran/pgt/compare/v1.1.0...v1.1.1) (2026-04-08)


### Bug Fixes

* deactivate existing active membership when assigning a new plan ([77fb943](https://github.com/iorran/pgt/commit/77fb943285fc76d16be625f7b2ab2ac88c721505))

# [1.1.0](https://github.com/iorran/pgt/compare/v1.0.0...v1.1.0) (2026-04-08)


### Features

* add loading state to all mutation buttons across the app ([deb01a6](https://github.com/iorran/pgt/commit/deb01a694efe73558d7eb0b24f259848eb8a85a0))

# 1.0.0 (2026-04-08)


### Bug Fixes

* add manual deploy trigger with skip change detection ([aa43710](https://github.com/iorran/pgt/commit/aa437100c5aca0170182b8598c01f15810dfc490))
* add packageManager field for turborepo ([94f6cf4](https://github.com/iorran/pgt/commit/94f6cf47d8c77024352f48004276deaebdf3c2fd))
* add QueryClientProvider to test render helper, install msw ([c28860e](https://github.com/iorran/pgt/commit/c28860e84ef2a9c6767ac049c060322b33d1ffa2))
* add trustedOrigins for CORS on betterauth routes ([36087db](https://github.com/iorran/pgt/commit/36087dbeb49a5a90415820a7f00d6862db98f161))
* add trustProxy to Fastify for correct protocol/host behind proxies ([69a8960](https://github.com/iorran/pgt/commit/69a89605690292af3f9c9b0ab13a2a9ae4b7f545))
* add vercel.json to apps/web for SPA rewrites ([09813cb](https://github.com/iorran/pgt/commit/09813cba898e17eb67cbb322c64647df8c02ccb2))
* alias Vercel deployment to pgt-alpha.vercel.app in CI ([3533d9c](https://github.com/iorran/pgt/commit/3533d9c0d0fbd6e4e915af9bf7015162614079df))
* cap test hours at 22 to avoid invalid 24:30 endTime in late-day CI runs ([f0f651a](https://github.com/iorran/pgt/commit/f0f651a5a0abad7b6ee7686364e60f692fedac97))
* clean package-lock from private registry, fix Dockerfile registry override ([ab758a0](https://github.com/iorran/pgt/commit/ab758a01fa91c55e4e28ea43048e19bf84f4b6ae))
* correct test assertions for SQL SUM strings and empty body responses ([4005e10](https://github.com/iorran/pgt/commit/4005e1050e9e710db909661c3c9dc39b4eb8aa79))
* explicitly set credentials include on auth client for cross-domain cookies ([8501fc1](https://github.com/iorran/pgt/commit/8501fc1a0cfd7254e7536844de0d59f6d404b106))
* hoist drizzle-orm to root for better-auth adapter resolution ([e3e5cdb](https://github.com/iorran/pgt/commit/e3e5cdbdbba3daf3f80319a5aa58d6da0ace7a7d))
* install from monorepo root for Vercel builds ([e59ebde](https://github.com/iorran/pgt/commit/e59ebde33f21bb645ac4418f01422f37262d98cd))
* make migration idempotent and clean duplicate checkins ([22694d3](https://github.com/iorran/pgt/commit/22694d3b088af07973c866d6532ae047d2dcae37))
* move vercel config to monorepo root, link project from root ([8ac50ab](https://github.com/iorran/pgt/commit/8ac50abe346134d82e5fcd6ced4a8cffa8d829a4))
* proxy API through Vercel to avoid third-party cookie issues ([e168278](https://github.com/iorran/pgt/commit/e1682788e7868e9ebdd1f309f48ddcc1d6a2942f))
* remove .js extensions from schema imports for drizzle-kit compat ([9e9dac6](https://github.com/iorran/pgt/commit/9e9dac6e58738eb8495e06373ed810f455b71891))
* remove alias step from CI, pgt-alpha.vercel.app is now a project domain ([e7782d5](https://github.com/iorran/pgt/commit/e7782d5ae6e26679f866fd5cd7ee78ae357af2db))
* resolve betterauth signup — boolean emailVerified, UUID generation, timestamp modes ([035168e](https://github.com/iorran/pgt/commit/035168e60a32e17a1c630c0ebbae9b9dac3bf00f))
* resolve duplicate text element assertions in component tests ([d37d52e](https://github.com/iorran/pgt/commit/d37d52e439ca1e6cdefd2e981f5c469e7a1f377c))
* resolve typescript errors in auth and layout components ([b599e08](https://github.com/iorran/pgt/commit/b599e0819a83e91a1f69ce28bc181a9f3beae514))
* rewrite auth route using Web Request API with proper CORS ([8fc31f7](https://github.com/iorran/pgt/commit/8fc31f7595b263f6bb36ebd29b99db10f3b4784f))
* set CORS headers manually for betterauth routes ([c595a4e](https://github.com/iorran/pgt/commit/c595a4edfb35b7f90471b1a4c3d8755c41059887))
* set SameSite=None for cross-domain cookies in production ([81caab6](https://github.com/iorran/pgt/commit/81caab69287ed624717e8d0404ba805814d19257))
* set status to pending during signup via databaseHook, remove separate join call ([a883610](https://github.com/iorran/pgt/commit/a8836108f6e21f7221d7dd5cc8ea1ac23774af49))
* skip signup when already logged in on criar-academia page ([bf7999e](https://github.com/iorran/pgt/commit/bf7999e7bfbdc6a7ac515c9ca2ca10df34fa4825))
* skip tsc in web build (vite handles types at dev time) ([9baf63c](https://github.com/iorran/pgt/commit/9baf63c47bc2887e73a71e0f1fdb66fb49a1b4de))
* student join flow — pass academyId in signup, allow entrar route for no-academy users, force reload after join ([1e67d82](https://github.com/iorran/pgt/commit/1e67d820051a831248239325ebda7de8d5483529))
* use full URL for betterauth client ([090e750](https://github.com/iorran/pgt/commit/090e750cdeb133bd273a5d61b240def01ec1b4ce))
* use noop email provider when RESEND_API_KEY is not set ([9546cdc](https://github.com/iorran/pgt/commit/9546cdc659608fd252c5bee6a02418e947f8c4b4))
* use npm install in CI to handle cross-platform optional deps ([dce6e89](https://github.com/iorran/pgt/commit/dce6e896f185b53584d3db301f57c50ec300c320))
* use postgres driver for Neon too (HTTP driver has version mismatch) ([4f620aa](https://github.com/iorran/pgt/commit/4f620aa145ba351baa435d2f6f58be21a83425fa))
* use requestPasswordReset instead of forgetPassword ([6e6d5dc](https://github.com/iorran/pgt/commit/6e6d5dc3ebe661f3836195e9f317343b860e5b07))
* use select for class type enum and add recurrence to form ([c5c1134](https://github.com/iorran/pgt/commit/c5c1134320d15f1bfab540da50ba5da47aa54bcc))
* use tsx runtime in Docker instead of compiled JS (extensionless imports) ([6f2a4bb](https://github.com/iorran/pgt/commit/6f2a4bb8c772bdac63ee1efc5e0b30a06bfa2c89))
* use vercel build --prebuilt for deployment ([dfbc077](https://github.com/iorran/pgt/commit/dfbc077c556c2302d1049ec680f0a5172ee36c30))
* wire real data to student detail stats and fix missing i18n keys ([8f28626](https://github.com/iorran/pgt/commit/8f28626c5604aa72a621d38b9e431ca16385b658))


### Features

* add academy location setup to dashboard ([1c8e97d](https://github.com/iorran/pgt/commit/1c8e97dcb9315566ee9675aeeb9cc178ec0560f1))
* add academy location update endpoint ([e096d97](https://github.com/iorran/pgt/commit/e096d9762b7bf14daae5c82d159e46e846afda04))
* add academy routes -- create, join, approve, reject ([4627ddd](https://github.com/iorran/pgt/commit/4627ddd84a460018b3b942612c363d5758fdf7e5))
* add app layout with sidebar and language switcher ([bad9245](https://github.com/iorran/pgt/commit/bad92453947414a6496be908368b45cc6d7c24cb))
* add check-in routes with streak tracking ([5011046](https://github.com/iorran/pgt/commit/5011046d6e6fd7f174f9befc1c29f489f31b6ce8))
* add checkin validation pipeline with time, duplicate, proximity checks ([f42dfdf](https://github.com/iorran/pgt/commit/f42dfdfa2d13ea1a2e92dd638bcf03f6d4d09a6b))
* add class CRUD routes with tests ([5b089c5](https://github.com/iorran/pgt/commit/5b089c5771e4dba446ff8a4c780108dec7f3642b))
* add class edit/delete and refactor create form to TanStack Form ([0c8621a](https://github.com/iorran/pgt/commit/0c8621a373cb49a3ebe63586838c129e04325eca))
* add class schedule and check-in pages ([b67cd4c](https://github.com/iorran/pgt/commit/b67cd4cc2a796f19d1fab2a1a96487471475e47f))
* add competition results with approval flow and XP award ([2e35423](https://github.com/iorran/pgt/commit/2e35423a391691d40b6475148b7ae5ffdf584a84))
* add docker-compose for postgres and fix env loading ([de60535](https://github.com/iorran/pgt/commit/de605350e9d912906c60a66f89f7b4d121a8cea7))
* add EmailProvider interface and ResendEmailProvider adapter ([d712233](https://github.com/iorran/pgt/commit/d7122339d266202f03dc84e28dcc113d09848c1b))
* add EmailService with password reset support ([29e636f](https://github.com/iorran/pgt/commit/29e636f1b996e94bcd98f774248fea5e415835d6))
* add Fly.io Dockerfile and config ([64271e5](https://github.com/iorran/pgt/commit/64271e576057e12b95df822a781972b091c9e640))
* add forgot password link and password reset routes ([70132d0](https://github.com/iorran/pgt/commit/70132d02a1ead51ae265187e4da7199338b40359))
* add forgot password page with tests ([36bb9bf](https://github.com/iorran/pgt/commit/36bb9bf182f1a2b7750a52451db13411c290f12d))
* add gamification pages — seasons, leaderboard, results, profile ([03a2e7c](https://github.com/iorran/pgt/commit/03a2e7c5a04e7b0cb6c25336a4b86f8cd6a7f6b7))
* add gamification profile, badge, and XP routes ([ccb4be8](https://github.com/iorran/pgt/commit/ccb4be8b5a61bece37b56412e8f93fb84ae982b9))
* add GitHub Actions CI/CD — test, migrate, deploy ([2e278d7](https://github.com/iorran/pgt/commit/2e278d76d12334b106f149947ea6701adf867562))
* add haversine distance calculation utility ([4300cdf](https://github.com/iorran/pgt/commit/4300cdfb18fb8f1a3e1fc95ce6fb22525c2025df))
* add join code generator utility ([ca1c953](https://github.com/iorran/pgt/commit/ca1c953864ac69f75b7a9e535af9f6bcc75a493e))
* add leaderboard endpoint with belt/age category filtering ([0c75aeb](https://github.com/iorran/pgt/commit/0c75aebec395f5209e6d3857f2e984874b469f39))
* add login and signup pages ([5f62d09](https://github.com/iorran/pgt/commit/5f62d09097ea2640886a54f2eee48c570a371cd9))
* add marketplace and order management pages ([95d5620](https://github.com/iorran/pgt/commit/95d5620ce474a1b836ac01976e213011f9db589d))
* add membership plan CRUD routes ([30bafb9](https://github.com/iorran/pgt/commit/30bafb9ca9e58a02ff0f8b75b364f46bfb93301d))
* add notification bell with overdue student dropdown ([cb7f781](https://github.com/iorran/pgt/commit/cb7f781421ef5fda57a8b2548e4af7a2ae80ae55))
* add notificationsMuted and lastOverdueEmailSentAt to membership schema ([c306097](https://github.com/iorran/pgt/commit/c3060978992dc79e85bd9cec97cfdba1d5e0f660))
* add onboarding fields to academy and user schemas ([c02cc7f](https://github.com/iorran/pgt/commit/c02cc7f45c65cf13a53f07fb62c5b5e633365425))
* add order request and tracking routes ([46f14bb](https://github.com/iorran/pgt/commit/46f14bbc1ddf80ced902e497d0a9994efedc494e))
* add overdue and upcoming payment banners to student dashboard ([5955a16](https://github.com/iorran/pgt/commit/5955a165c4d6fb2026a66a9a6b5bd97375c98da5))
* add overdue payment email template and service method ([76d3142](https://github.com/iorran/pgt/commit/76d314231d17737c969e21f087ac283d2c0bc137))
* add password reset email template ([574e59c](https://github.com/iorran/pgt/commit/574e59cdb46845822feef0b5bb5ad96a036e94bb))
* add password reset i18n translation keys ([2914397](https://github.com/iorran/pgt/commit/29143973d32a5322d5e97f4d1a49d2f14a9f183b))
* add payment notification translation keys ([3605ee6](https://github.com/iorran/pgt/commit/3605ee6487a85b8d8cca5dde21b233e0c85770a7))
* add payment status, overdue email, and mute toggle endpoints ([4c91254](https://github.com/iorran/pgt/commit/4c9125444516a63f3392d8d79cd693c7d763da37))
* add payment tracking and overdue dashboard routes ([5d51433](https://github.com/iorran/pgt/commit/5d51433186c1a202132d862f96f580fc099065cd))
* add product catalog CRUD routes ([a7dc16a](https://github.com/iorran/pgt/commit/a7dc16ad44e3c7275d76d8e567d7cabd144cbdcf))
* add QR scan landing page for student checkin ([e2cd779](https://github.com/iorran/pgt/commit/e2cd779f52a269561ab0ab45936b2cdcbe8592a3))
* add QR token generation and validation for checkin ([1fe3c92](https://github.com/iorran/pgt/commit/1fe3c9207c915fd349adfd120edec5f870fb3825))
* add react-query and refactor all pages to use query hooks ([c924819](https://github.com/iorran/pgt/commit/c924819abfc08b2063e76d4f4ac59e950d4b4117))
* add real data counts and skeleton loading to dashboard ([0fee59a](https://github.com/iorran/pgt/commit/0fee59a4994db952a26bb83fc72f1c1a6d176bb8))
* add reset password page with tests ([8fd3af8](https://github.com/iorran/pgt/commit/8fd3af810428b9daef2f37289691d7408b11e30a))
* add schema for checkin tokens, location, and source tracking ([5b32930](https://github.com/iorran/pgt/commit/5b3293003c63899794b08d6fbf8b08223fe8eb5a))
* add season CRUD routes ([47c36eb](https://github.com/iorran/pgt/commit/47c36ebf5c9180edc65c143f39d885a2fc31b4a8))
* add seed script with demo academy data ([7ba7247](https://github.com/iorran/pgt/commit/7ba7247fef5c6559de048bf0b390271e49483445))
* add student management and membership assignment routes ([433da97](https://github.com/iorran/pgt/commit/433da97f7279bc1de3cf82febd106ffab3b2a1bc))
* add student registry and billing pages ([7cbc463](https://github.com/iorran/pgt/commit/7cbc463c553a0bf6afdba396e762212e061a65a1))
* add tab navigation to billing, marketplace, gamification, classes, and students sections ([f482d78](https://github.com/iorran/pgt/commit/f482d78e6746b43df355251be041d8170eaa6162))
* add tailwind v4 with arena design system ([186d3ec](https://github.com/iorran/pgt/commit/186d3ec87c174fcaa911e1ff9077d381540d2640))
* add time window check utility for class checkin ([6b920be](https://github.com/iorran/pgt/commit/6b920be2aebb4499231c4df0e09a1394e63927c8))
* add totem and checkin scan routes ([1dad4d1](https://github.com/iorran/pgt/commit/1dad4d12cba5baff7dce76ce3ea8e2f1296c0b55))
* add totem page for instructor QR code display ([60971f8](https://github.com/iorran/pgt/commit/60971f87fb3f9575438934daac64521dbc0b9ee8))
* add tournament listing and signup page ([f880272](https://github.com/iorran/pgt/commit/f88027297108fa26cee6ffc8032d517d9c884d42))
* add tournament listing and signup routes ([635a12b](https://github.com/iorran/pgt/commit/635a12bfec728966136a2dc3ad9e44582e343b42))
* add translation keys for smart checkin system ([8f1b396](https://github.com/iorran/pgt/commit/8f1b39682c762f3dbf8bb46bbd105381f159548a))
* add Vercel config with SPA rewrites ([478ec59](https://github.com/iorran/pgt/commit/478ec599f9b27e5cb506dafe7cdb5d24da60faa9))
* define complete database schema with drizzle ([04a5a3a](https://github.com/iorran/pgt/commit/04a5a3a417e33e7c98c3ed77bc7e78cff725680f))
* env-driven API base URL for production deploy ([34d00d4](https://github.com/iorran/pgt/commit/34d00d4285464754fb95ea4a5937eed2b225030c))
* env-driven CORS and Neon serverless DB support ([250abde](https://github.com/iorran/pgt/commit/250abde3997b6036c7fa26ad5fa40785d075f884))
* export forgetPassword and resetPassword from auth client ([e6b582a](https://github.com/iorran/pgt/commit/e6b582aaa853e4fcfe360fbddd036a4023fe120c))
* implement onboarding flow — signup, create academy, join, approve, dashboard ([5c0e57b](https://github.com/iorran/pgt/commit/5c0e57b0d22efbdacd0b173cb113797ab57ed581))
* make academyId optional in betterauth config ([2d617ff](https://github.com/iorran/pgt/commit/2d617ff66ffacf2b9e63f5388f28f1be03817505))
* move academy location to settings page, add settings nav item ([4ad77ac](https://github.com/iorran/pgt/commit/4ad77acfd6380733acb8f4bfbdb6f14b8cf756d2))
* multi-day class creation with toggle buttons + fix missing i18n key ([d7e65a7](https://github.com/iorran/pgt/commit/d7e65a785ebe04abd427f45ce94a813fa7a60a9f))
* refactor classes, billing, and student pages with Arena design ([8d80fce](https://github.com/iorran/pgt/commit/8d80fcef67967ea321c00f21eb7263a3df7ab95c))
* refactor layout and auth pages with Arena design system ([78bf1d3](https://github.com/iorran/pgt/commit/78bf1d3e3bef1cf810c7ed3be0b47bcf04bf6e8a))
* refactor marketplace, gamification, and tournament pages with Arena design ([b92ee4b](https://github.com/iorran/pgt/commit/b92ee4b449916c98b36d93c8109d0069cf7a1526))
* replace plan text input with dropdown picker on student detail ([07062f9](https://github.com/iorran/pgt/commit/07062f9852e499a52dd3710b8a5219e967626cd3))
* setup betterauth with session and tenant middleware ([8ff1b48](https://github.com/iorran/pgt/commit/8ff1b48a2453987d62ce9c1ab90328f3701fb54c))
* setup react frontend with vite, i18n, and auth client ([d2df26c](https://github.com/iorran/pgt/commit/d2df26c166aa7db4cb0755120d541416b82b42d4))
* setup shadcn/ui with Arena dark design system ([53caf9d](https://github.com/iorran/pgt/commit/53caf9d3756256938b43099fbfbd43e3f9067d64))
* setup test DB infrastructure with cleanup, factories, and auth bypass ([b150e44](https://github.com/iorran/pgt/commit/b150e444ca225dd906fe8d1b022daaea22dfdbae))
* setup vitest + testing-library for React component tests ([1258e15](https://github.com/iorran/pgt/commit/1258e152bc2cb7f2d50f5104a99c27d74773945b))
* setup vitest and test helpers ([174e069](https://github.com/iorran/pgt/commit/174e069525e17693f503a69dabaf03827a9b6d7e))
* show build timestamp in sidebar next to version ([c09d8fb](https://github.com/iorran/pgt/commit/c09d8fb7e8f483a089a49a3b46ec15cbe8e9e88f))
* show full datetime with minutes in sidebar version ([90857d3](https://github.com/iorran/pgt/commit/90857d3f8d123f34008cbfefae3ab48b3e062241))
* smart checkin system with proximity and QR code support ([5c657aa](https://github.com/iorran/pgt/commit/5c657aab42e2f3c4f3d0026e56a2fe178ddb4174))
* update classes page with proximity and QR checkin buttons ([6810b4b](https://github.com/iorran/pgt/commit/6810b4bb98dbf55673b4faa780405fe456e691c0))
* update seed with onboarding fields ([2fa893f](https://github.com/iorran/pgt/commit/2fa893f231fdb1f14693fd91295c8becd89c8afa))
* wire email service into BetterAuth sendResetPassword hook ([7afd945](https://github.com/iorran/pgt/commit/7afd94523c0c518173711f1985d21529ab6f3174))
