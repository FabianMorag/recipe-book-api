# Design: Recipe CRUD

## Technical Approach

Add a `RecipesModule` as a NestJS feature module registered in `AppModule`. The module exposes recipe REST endpoints through `RecipesController`, keeps authorization and Prisma query shaping in `RecipesService`, and enables DTO validation through a global `ValidationPipe`. Prisma changes replace `Recipe.isPublic` with `RecipeStatus` so the API can represent `DRAFT`, `PRIVATE`, and `PUBLIC` from the `recipe-management` spec.

## Architecture Decisions

| Option | Tradeoff | Decision |
|--------|----------|----------|
| Feature module under `src/recipes/` | Keeps controller/service/DTO/tests co-located; adds one `AppModule` import | Use `RecipesModule` with `RecipesController`, `RecipesService`, and DTOs. |
| Controller-owned access checks | Thin controller is easier to read, but repeated predicates leak policy | Centralize ownership/public visibility in `RecipesService` query helpers. |
| Dedicated auth guard now | Reusable later, but current auth API only exposes `AuthService.getSession(req)` | For this slice, inject `AuthService` in controller and use small private helpers: required user for owner routes, optional user for public/detail routes. |
| Return 403 for private/draft access | More explicit, but leaks resource existence | Return 404 for non-owner access to `DRAFT`/`PRIVATE`, matching spec. |
| Map `isPublic=false` to `DRAFT` | Could surprise existing private users | Map `true -> PUBLIC`, `false -> PRIVATE`; new recipes default to `DRAFT`. |

## Data Flow

```text
HTTP request ──→ RecipesController ──→ AuthService.getSession(req)
                     │                         │
                     └── DTO/param validation  │
                              ↓                │
                         RecipesService ──→ PrismaService ──→ recipes table
                              │
                              └── visibility predicates: owner OR status PUBLIC
```

Module dependencies:

```text
AppModule ──→ PrismaModule (global)
    ├──────→ AuthModule
    └──────→ RecipesModule ──→ AuthService, PrismaService
```

## File Changes

| File | Action | Description |
|------|--------|-------------|
| `src/app.module.ts` | Modify | Import `RecipesModule`. |
| `src/main.ts` | Modify | Enable global `ValidationPipe` with whitelist and transform. |
| `package.json` | Modify | Add `class-validator`/`class-transformer` if absent. |
| `src/recipes/recipes.module.ts` | Create | Feature module; imports `AuthModule` only if `AuthService` is exported there. |
| `src/auth/auth.module.ts` | Modify | Export `AuthService` for recipe session lookup. |
| `src/recipes/recipes.controller.ts` | Create | Routes and session extraction. |
| `src/recipes/recipes.service.ts` | Create | Prisma CRUD, response mapping, ownership/visibility queries. |
| `src/recipes/dto/*.dto.ts` | Create | Create/update/query/param DTOs. |
| `src/recipes/recipes.*.spec.ts` | Create | Strict TDD unit coverage for controller/service. |
| `test/recipes.e2e-spec.ts` | Create | Anonymous/owner/non-owner route coverage with mocked Prisma/Auth bootstrap as needed. |
| `prisma/schema.prisma` | Modify | Add `RecipeStatus`; replace `isPublic` with `status @default(DRAFT) @map("status")`; add indexes. |
| `prisma/migrations/*/migration.sql` | Create | Safe enum/status migration. |

## Interfaces / Contracts

Routes:

| Method | Path | Auth | Response |
|--------|------|------|----------|
| `POST` | `/recipes` | Required | `201 RecipeResponse` |
| `GET` | `/recipes` | Required | `200 RecipeListItem[]` owned by session user |
| `GET` | `/recipes/public` | Optional | `200 RecipeListItem[]` with `status=PUBLIC` |
| `GET` | `/recipes/:id` | Optional | `200 RecipeResponse` if public or owner; else `404` |
| `PATCH` | `/recipes/:id` | Required | `200 RecipeResponse` if owner; anonymous `401`; non-owner `404` |

DTO contracts:

```ts
type RecipeStatus = 'DRAFT' | 'PRIVATE' | 'PUBLIC'
type CreateRecipeDto = { title: string; description?: string | null; status?: RecipeStatus }
type UpdateRecipeDto = Partial<CreateRecipeDto>
type RecipeListItem = { id: string; title: string; description: string | null; status: RecipeStatus; createdAt: string }
type RecipeResponse = { id: string; title: string; description: string | null; status: RecipeStatus; createdAt: string; updatedAt: string }
```

Validation: use `class-validator` decorators on DTOs (`@IsString`, `@IsNotEmpty`, `@MaxLength`, `@IsOptional`, `@IsEnum`) and enable/verify `ValidationPipe` behavior before implementation. Use `ParseUUIDPipe` only if IDs become UUID; current Prisma uses `cuid()`, so validate as non-empty string to avoid rejecting valid IDs.

## Testing Strategy

| Layer | What to Test | Approach |
|-------|-------------|----------|
| Unit | Service query predicates, default status, update ownership, 404 hiding | RED first with mocked `PrismaService`. |
| Unit | Controller required/optional session behavior | Mock `AuthService.getSession`; assert `401` vs service call. |
| E2E | Public list/detail anonymous, owner list/update, non-owner private/detail/update | Supertest Nest app; override Auth.js/bootstrap and Prisma with deterministic fakes or test DB. |

## Migration / Rollout

Create enum `RecipeStatus`, add nullable `status`, backfill from `is_public`, set `NOT NULL DEFAULT 'DRAFT'`, then drop `is_public`. Add indexes for `status`, `author_id`, and optionally `(author_id, status)`. Rollback maps `PUBLIC` to `is_public=true`; all other statuses to `false`.

## Open Questions

- [ ] Whether public list pagination is required now; spec omits it, so design keeps arrays unpaginated for first slice.
