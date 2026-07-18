# Design: Recipe Content First Backend Slice

## Skill Resolution

- `skill_resolution`: `paths-injected`
- Loaded skills:
  - `.agents/skills/nestjs-best-practices/SKILL.md`
  - `.agents/skills/prisma-cli/SKILL.md`
  - `.agents/skills/prisma-client-api/SKILL.md`

## Scope

This design covers only the first backend slice for `recipe-content`:

- Add Prisma scalar recipe fields: `servings`, `imageUrl`, and `tags`.
- Add nested recipe author/profile response shape: `author: { id, name, image }`.
- Update create/update DTO validation, response DTOs, explicit Prisma selects, service mapping, and tests.
- Preserve existing recipes routes, ownership checks, and public/draft/private visibility rules.

Deferred: ingredients, steps, nested writes, search/filtering by tags, media upload/storage, and AI-assisted generation.

## Current Architecture

Recipes are implemented as a NestJS feature module with one controller and one service. `RecipesService` owns access-control decisions and Prisma query/mapping shape. `PrismaModule` is global, so `RecipesModule` imports only `AuthModule` for session lookup while injecting `PrismaService` directly into `RecipesService`.

```text
AppModule
  ├─ PrismaModule (global provider: PrismaService)
  ├─ AuthModule (provider: AuthService)
  └─ RecipesModule
       ├─ imports: AuthModule
       ├─ controller: RecipesController
       └─ provider: RecipesService
              └─ injects PrismaService
```

No new NestJS module is required. The implementation SHOULD keep the recipe-content changes inside the existing recipes feature boundary.

## Architecture Decisions

### AD-1: Store first-slice content as scalar columns on `recipes`

Add nullable/array columns directly to `Recipe` instead of new child tables:

```prisma
model Recipe {
  id          String       @id @default(cuid())
  title       String
  description String?
  servings    Int?
  imageUrl    String?      @map("image_url")
  tags        String[]     @default([])
  status      RecipeStatus @default(DRAFT)
  authorId    String       @map("author_id")
  author      User         @relation(fields: [authorId], references: [id], onDelete: Cascade)
  createdAt   DateTime     @default(now()) @map("created_at")
  updatedAt   DateTime     @updatedAt @map("updated_at")

  @@index([authorId])
  @@index([status])
  @@index([authorId, status])
  @@map("recipes")
}
```

Rationale: these fields are small, first-class recipe metadata and do not require ordering or nested writes. Ingredients/steps remain deferred because they need normalized ordered child tables.

### AD-2: Use a Prisma migration, not `db push`

Implementation MUST create a Prisma migration, for example:

```sql
ALTER TABLE "recipes" ADD COLUMN "servings" INTEGER;
ALTER TABLE "recipes" ADD COLUMN "image_url" TEXT;
ALTER TABLE "recipes" ADD COLUMN "tags" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[];
```

The migration SHOULD be generated with Prisma migrate and the Prisma Client MUST be regenerated afterward. No data backfill is required: existing recipes get `servings = NULL`, `image_url = NULL`, and `tags = []`.

### AD-3: Keep explicit Prisma selects and response mapping

`RecipesService` SHOULD continue using static explicit select objects. Both list and detail responses include the same first-slice scalar fields and nested author profile fields.

Target list select shape:

```ts
static readonly authorSelect = {
  id: true,
  name: true,
  image: true,
} as const

static readonly listSelect = {
  id: true,
  title: true,
  description: true,
  servings: true,
  imageUrl: true,
  tags: true,
  status: true,
  createdAt: true,
  author: { select: RecipesService.authorSelect },
} as const

static readonly detailSelect = {
  ...RecipesService.listSelect,
  updatedAt: true,
  authorId: true,
} as const
```

Rationale: explicit selects avoid accidental payload expansion and make DTO mapping testable. `authorId` remains selected for detail authorization but is not returned as a top-level API field.

### AD-4: Null and empty semantics are part of the API contract

Response semantics MUST be consistent for list and detail responses:

- `servings`: `number | null`; missing create/update value maps to `null`.
- `imageUrl`: `string | null`; missing create/update value maps to `null`; update with `null` clears it.
- `tags`: `string[]`; missing create value maps to `[]`; update with `[]` clears all tags; omitted update leaves tags unchanged.
- `author.name` and `author.image`: `string | null`, following Auth.js `User` profile fields.

Service mapping SHOULD defensively coerce `recipe.tags ?? []` to preserve response shape even if a fake or old row returns null.

### AD-5: Validation stays at DTO boundaries

`CreateRecipeDto` and `UpdateRecipeDto` own input validation using class-validator and Swagger decorators. Recommended constraints:

- `servings`
  - optional
  - integer
  - minimum `1`
  - nullable clearing allowed on update if API chooses `servings?: number | null`; if allowed, combine nullable handling with validation so `null` is accepted and persisted as `null`.
- `imageUrl`
  - optional
  - URL string when present
  - max length, recommended `2048`
  - nullable clearing allowed on update.
- `tags`
  - optional array
  - each item string, non-empty after trimming policy, max length recommended `40`
  - array max size recommended `20`

Implementation SHOULD avoid adding custom providers for validation unless existing decorators cannot express the chosen semantics. With the current global `ValidationPipe({ whitelist: true, transform: true, forbidNonWhitelisted: true })`, tests MUST cover non-whitelisted properties and invalid field values.

## API Contract

Routes remain unchanged:

- `POST /recipes`
- `GET /recipes`
- `GET /recipes/public`
- `GET /recipes/:id`
- `PATCH /recipes/:id`

### Create request additions

```ts
{
  title: string
  description?: string | null
  status?: 'DRAFT' | 'PRIVATE' | 'PUBLIC'
  servings?: number | null
  imageUrl?: string | null
  tags?: string[]
}
```

Create defaults:

- `status` defaults to `DRAFT`.
- `description`, `servings`, and `imageUrl` default to `null`.
- `tags` defaults to `[]`.

### Update request additions

All fields are optional. Omitted fields MUST not change persisted values. Explicit nullable fields MAY clear nullable scalars:

```ts
{
  title?: string
  description?: string | null
  status?: 'DRAFT' | 'PRIVATE' | 'PUBLIC'
  servings?: number | null
  imageUrl?: string | null
  tags?: string[]
}
```

### Response additions

List and detail responses include:

```ts
{
  id: string
  title: string
  description: string | null
  servings: number | null
  imageUrl: string | null
  tags: string[]
  status: 'DRAFT' | 'PRIVATE' | 'PUBLIC'
  createdAt: string
  author: {
    id: string
    name: string | null
    image: string | null
  }
}
```

Detail responses additionally include `updatedAt`.

## Data Flow

### Create

```text
RecipesController.create
  └─ requireUserId(AuthService)
  └─ RecipesService.create(ownerId, dto)
       ├─ assertValidStatus(dto.status)
       ├─ prisma.recipe.create({ data: mapped fields, select/detail shape })
       └─ toRecipeResponse(recipe)
```

The create call SHOULD use `select: RecipesService.detailSelect` so the returned record has author profile fields without relying on Prisma's default return shape.

### List

```text
GET /recipes or /recipes/public
  └─ RecipesService.findAllByOwner/findAllPublic
       ├─ prisma.recipe.findMany({ where, orderBy, select: listSelect })
       └─ records.map(toRecipeListItem)
```

Visibility rules stay unchanged.

### Detail

```text
GET /recipes/:id
  └─ optionalUserId(AuthService)
  └─ RecipesService.findOneOrNotFound(id, requesterId)
       ├─ prisma.recipe.findUnique({ select: detailSelect })
       ├─ canRead(recipe, requesterId)
       └─ toRecipeResponse(recipe)
```

`authorId` is selected only for `canRead`.

### Update

```text
PATCH /recipes/:id
  └─ requireUserId(AuthService)
  └─ RecipesService.update(id, ownerId, dto)
       ├─ assertValidStatus(dto.status)
       ├─ prisma.recipe.findFirst({ where: { id, authorId: ownerId }, select: { id: true } })
       ├─ toUpdateData(dto)
       ├─ prisma.recipe.update({ where: { id }, data, select: detailSelect })
       └─ toRecipeResponse(recipe)
```

Ownership check remains service-level and centralized.

## File Changes

- `prisma/schema.prisma`
  - Add `servings Int?`, `imageUrl String? @map("image_url")`, `tags String[] @default([])` to `Recipe`.
- `prisma/migrations/<timestamp>_recipe_content/migration.sql`
  - Add nullable scalar columns and non-null `tags` array with default.
- `src/recipes/dto/create-recipe.dto.ts`
  - Add Swagger metadata and validation decorators for `servings`, `imageUrl`, and `tags`.
- `src/recipes/dto/update-recipe.dto.ts`
  - Add matching partial update validation and clearing semantics.
- `src/recipes/dto/recipe-response.dto.ts`
  - Add `RecipeAuthorDto` and response fields to `RecipeListItemDto`/`RecipeResponseDto`.
- `src/recipes/recipes.service.ts`
  - Extend service types, explicit selects, create/update data mapping, list/detail response mapping, and author mapping.
- `src/recipes/recipes.controller.ts`
  - No route changes expected; Swagger decorators should continue referencing updated DTO classes.
- `src/recipes/recipes.service.spec.ts`
  - Update base fixtures and add coverage for defaults, explicit values, update clearing, tags empty-array mapping, and author mapping.
- `test/recipes.e2e-spec.ts`
  - Update fake Prisma types/data and add validation/visibility/response shape coverage.
- `test/app.e2e-spec.ts`
  - Update OpenAPI snapshot/expectations if DTO schema assertions include recipes.

## Testing Strategy

Strict TDD is enabled for apply. Write failing tests before implementation.

### Unit tests (`src/recipes/recipes.service.spec.ts`)

Add or update tests for:

- Create defaults: `servings: null`, `imageUrl: null`, `tags: []`, and mapped author object in response.
- Create explicit fields: persists and returns `servings`, `imageUrl`, `tags`.
- List owner/public selects include scalar fields and nested author select.
- Detail response includes author while preserving public/owner-only visibility.
- Update maps only provided fields; omitted fields are not sent in `data`.
- Update with empty `tags: []` clears tags.
- Nullable update clears `servings`/`imageUrl` if nullable clearing is implemented.
- Invalid status still fails before database lookup.

### E2E tests (`test/recipes.e2e-spec.ts`)

Add or update tests for:

- Create accepts valid content fields and returns complete response shape.
- Create rejects `servings <= 0`, non-integer servings, invalid `imageUrl`, non-array tags, empty tag strings, too-long tags, and too many tags.
- Owner list and public list include new fields and author object without exposing top-level `authorId`.
- Detail visibility remains unchanged for public, private, draft, owner, non-owner, and anonymous requesters.
- Patch can update scalar content and can clear tags with an empty array.
- Unknown request fields remain rejected by global validation.

### Verification commands

Implementation verification SHOULD run:

```bash
pnpm run test
pnpm run test:e2e
pnpm run build
pnpm run lint
```

Use Prisma commands appropriate to the project setup during implementation, including schema validation/generation after migration creation.

## Rollout and Backward Compatibility

- The migration is additive and nullable/defaulted, so existing recipes remain readable.
- Existing clients receive additional response fields; routes and visibility behavior are unchanged.
- Deploy order: apply migration, regenerate/build application with updated Prisma Client, then deploy API.
- Rollback before production deploy can revert migration and code together. After production deploy, only remove columns after confirming no generated frontend/client code depends on them.

## Risks and Mitigations

| Risk | Mitigation |
| --- | --- |
| Scope expands into ingredients/steps or AI | Keep this change limited to scalar columns and author DTO; create follow-up change for normalized child records. |
| Response shape drifts from Prisma select | Use explicit selects and service mapping tests. |
| Ambiguous `tags` null behavior | Store non-null array with default and map missing/null to `[]` in responses. |
| Validation rejects intended nullable clears | Add e2e tests for the chosen null/clear semantics before implementation. |
| PostgreSQL array portability | Project is PostgreSQL; document `String[]` as PostgreSQL-backed and use Prisma migration. |
| Migration/client mismatch | Regenerate Prisma Client after migration and run build/type checks. |
| Review budget overrun | Do not add ingredient/step tables, filtering, or UI changes in this PR. |
