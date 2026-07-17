# Tasks: Recipe CRUD

## Review Workload Forecast

| Field | Value |
|-------|-------|
| Estimated changed lines | 700–780 |
| 800-line budget risk | Medium |
| Chained PRs recommended | No |
| Suggested split | Single PR |
| Delivery strategy | single-pr-default |
| Chain strategy | pending |

Decision needed before apply: No
Chained PRs recommended: No
Chain strategy: pending
800-line budget risk: Medium

### Suggested Work Units

| Unit | Goal | Likely PR | Notes |
|------|------|-----------|-------|
| 1 | Full recipe CRUD (schema + module + tests) | Single PR | All phases delivered together; 700–780 changed lines |

## Phase 1: Schema, Validation & Auth Wiring (Foundation)

- [x] 1.1 Add `class-validator` and `class-transformer` to `package.json` (`pnpm add class-validator class-transformer`)
- [x] 1.2 Add `RecipeStatus` enum to `prisma/schema.prisma`, add nullable `status` column, add indexes on `(status)` and `(author_id, status)`
- [x] 1.3 Write migration SQL: create enum, backfill `status` from `isPublic` (`true→PUBLIC`, `false→PRIVATE`), set `NOT NULL DEFAULT 'DRAFT'`, drop `is_public`
- [x] 1.4 Run `pnpm exec prisma db push` (or migrate) and `pnpm run db:generate` to regenerate Prisma client
- [x] 1.5 Enable global `ValidationPipe` in `src/main.ts` with `whitelist: true, transform: true, forbidNonWhitelisted: true`
- [x] 1.6 Export `AuthService` from `src/auth/auth.module.ts` so `RecipesModule` can inject it

## Phase 2: Recipes Module Core (Service + DTOs) — TDD Red/Green

- [x] 2.1 Create `src/recipes/dto/create-recipe.dto.ts` with `@IsString`, `@IsNotEmpty`, `@MaxLength(200)` on title; `@IsOptional`, `@IsString`, `@MaxLength(2000)` on description; `@IsOptional`, `@IsEnum(RecipeStatus)` on status
- [x] 2.2 Create `src/recipes/dto/update-recipe.dto.ts` as `PartialType(CreateRecipeDto)` or manual `Partial<CreateRecipeDto>` with all fields optional
- [x] 2.3 Write RED tests for `RecipesService` in `src/recipes/recipes.service.spec.ts`: mock `PrismaService`; cover `create` (default status=DRAFT, explicit status, null description), `findAllByOwner`, `findAllPublic`, `findOneOrNotFound` (public→200, owner-private→200, non-owner-private→404, missing→404), `update` (owner success, non-owner→404, invalid status→400)
- [x] 2.4 Create `src/recipes/recipes.service.ts` — implement `create`, `findAllByOwner`, `findAllPublic`, `findOneOrNotFound` (ownership+public visibility predicate), `update` (owner-only) using `PrismaService`
- [x] 2.5 Run service unit tests green: `pnpm run test -- --testPathPattern='recipes.service.spec'`

## Phase 3: Controller & Module Wiring — TDD Red/Green

- [x] 3.1 Write RED tests for `RecipesController` in `src/recipes/recipes.controller.spec.ts`: mock `AuthService.getSession` and `RecipesService`; cover POST (201, 400, 401), GET `/recipes` (200 owner list, 401 anon), GET `/recipes/public` (200 anon, 200 auth, empty list), GET `/recipes/:id` (200 public, 200 owner-private, 404 non-owner, 404 missing), PATCH `/recipes/:id` (200 update, 401 anon, 404 non-owner, 400 invalid status)
- [x] 3.2 Create `src/recipes/recipes.controller.ts` with route handlers: `@Post()`, `@Get()` (my recipes), `@Get('public')`, `@Get(':id')`, `@Patch(':id')`; inject `AuthService` for `req.session` extraction per design section "Auth integration"
- [x] 3.3 Create `src/recipes/recipes.module.ts` — import `AuthModule`, declare `RecipesController` and `RecipesService`
- [x] 3.4 Import `RecipesModule` into `src/app.module.ts`
- [x] 3.5 Run controller unit tests green: `pnpm run test -- --testPathPattern='recipes.controller.spec'`

## Phase 4: E2E Verification

- [x] 4.1 Create `test/recipes.e2e-spec.ts`: override `PrismaService` and `AuthBootstrap` per existing e2e pattern; test all spec scenarios (anon create→401, owner create→201, anon list public→200/2, owner list my→200/3, anon view private→404, owner view private→200, non-owner view private→404, anon update→401, owner update→200, non-owner update→404, invalid status update→400, empty title→400, missing recipe→404)
- [x] 4.2 Run e2e suite: `pnpm run test:e2e`
- [x] 4.3 Run full test suite: `pnpm run test:ci && pnpm run test:e2e:ci`
- [x] 4.4 Run lint: `pnpm run lint`
- [x] 4.5 Verify type check: `npx tsc --noEmit`
