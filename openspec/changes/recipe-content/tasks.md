# Tasks: Recipe Content – First Backend Slice

## Review Workload Forecast

| Field | Value |
|-------|-------|
| Estimated changed lines | 400–550 |
| 400-line budget risk | Low |
| Chained PRs recommended | No |
| Suggested split | single PR |
| Delivery strategy | single-pr |
| Chain strategy | size-exception |

Decision needed before apply: No
Chained PRs recommended: No
Chain strategy: size-exception
400-line budget risk: Low

---

## Scope

**In scope:** scalar recipe fields (`servings`, `imageUrl`, `tags`) plus `author: { id, name, image }` in responses across all recipe endpoints. Prisma migration, DTO validation, service select/mapping, unit tests, e2e tests, OpenAPI snapshot.

**Deferred:** ingredients, steps, nested writes, AI generation, search/filter by tags.

---

## Task ordering

Tasks follow a strict TDD pattern: **tests first, then implementation, then verify**. Each phase group is ordered: RED → GREEN → VERIFY.

---

## Phase 1: Prisma Schema + Migration (prerequisite)

### Task 1.1: Add scalar content fields to Prisma schema

**File:** `prisma/schema.prisma`

Add three fields to the `Recipe` model:

```prisma
servings    Int?
imageUrl    String?      @map("image_url")
tags        String[]     @default([])
```

Insert them between `description` and `status` (keeping existing fields in place).

**Verification:** `pnpm exec prisma validate`

---

### Task 1.2: Create and review Prisma migration

Run Prisma migration to generate the SQL:

```bash
pnpm exec prisma migrate dev --name recipe_content
```

Review the generated `prisma/migrations/*_recipe_content/migration.sql`. It should contain:

```sql
ALTER TABLE "recipes" ADD COLUMN "servings" INTEGER;
ALTER TABLE "recipes" ADD COLUMN "image_url" TEXT;
ALTER TABLE "recipes" ADD COLUMN "tags" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[];
```

**Verification:** migration file exists and is syntactically correct.

---

### Task 1.3: Regenerate Prisma Client

```bash
pnpm exec prisma generate
```

**Verification:** `src/generated/prisma` is updated; `Recipe` types include `servings`, `imageUrl`, `tags`.

---

## Phase 2: DTOs — Author and New Fields

### Task 2.1: Create `RecipeAuthorDto` (no test changes yet)

**File:** `src/recipes/dto/recipe-response.dto.ts`

Add a new class above `RecipeListItemDto`:

```ts
export class RecipeAuthorDto {
  @ApiProperty({ example: 'user_abc123' })
  id!: string

  @ApiProperty({ example: 'Alice', nullable: true })
  name!: string | null

  @ApiProperty({ example: 'https://example.com/alice.jpg', nullable: true })
  image!: string | null
}
```

Import `ApiProperty` (already imported — no new imports needed).

**Verification:** `pnpm exec tsc --noEmit` passes.

---

### Task 2.2: Extend `RecipeListItemDto` and `RecipeResponseDto` with content fields

**File:** `src/recipes/dto/recipe-response.dto.ts`

Add to `RecipeListItemDto` (order: after `status`, before `createdAt`):

- `servings: number | null` with `@ApiProperty({ example: 4, nullable: true })`
- `imageUrl: string | null` with `@ApiProperty({ example: 'https://...', nullable: true })`
- `tags: string[]` with `@ApiProperty({ example: ['italian', 'quick'] })`
- `author: RecipeAuthorDto` with `@ApiProperty({ type: RecipeAuthorDto })`

`RecipeResponseDto` inherits these from `RecipeListItemDto` plus `updatedAt` (already present). No changes needed to `RecipeResponseDto` itself.

**Verification:** `pnpm exec tsc --noEmit` passes.

---

### Task 2.3: Extend `CreateRecipeDto` with servings, imageUrl, tags

**File:** `src/recipes/dto/create-recipe.dto.ts`

Add imports at top:

```ts
import {
  ArrayMaxSize,
  IsArray,
  IsInt,
  IsNotEmpty,
  IsOptional,
  IsString,
  IsUrl,
  MaxLength,
  Min,
} from 'class-validator' // merge with existing imports
```

Add these fields between `description` and `status`:

```ts
@ApiPropertyOptional({
  example: 4,
  description: 'Number of servings. Positive integer.',
  minimum: 1,
  nullable: true,
})
@IsOptional()
@IsInt()
@Min(1)
servings?: number | null

@ApiPropertyOptional({
  example: 'https://example.com/pasta.jpg',
  description: 'URL to a recipe image.',
  maxLength: 2048,
  nullable: true,
})
@IsOptional()
@IsUrl()
@MaxLength(2048)
imageUrl?: string | null

@ApiPropertyOptional({
  example: ['italian', 'quick'],
  description: 'Tags for filtering and display.',
  type: [String],
})
@IsOptional()
@IsArray()
@IsString({ each: true })
@MaxLength(40, { each: true })
@ArrayMaxSize(20)
tags?: string[]
```

The `tags` items must also be non-empty. Since `@IsString` is not enough to reject empty strings, add a custom validation or rely on `@IsNotEmpty` per item. Easiest: use `@IsNotEmpty({ each: true })` on `tags` (import from class-validator).

**Verification:** `pnpm exec tsc --noEmit` passes.

---

### Task 2.4: Extend `UpdateRecipeDto` with servings, imageUrl, tags

**File:** `src/recipes/dto/update-recipe.dto.ts`

Add the same imports as in Task 2.3. Add the same three fields between `description` and `status`, all `@IsOptional()`. Same validation constraints as `CreateRecipeDto` for each.

Tags clearing semantics: `tags` as `string[] | null` with `@IsOptional()` means an omitted `tags` leaves it unchanged; sending `tags: []` or `tags: null` clears all tags; sending `tags: ["new"]` replaces. `servings: null` and `imageUrl: null` also clear those optional fields. The service `toUpdateData` must handle undefined vs provided/null values.

**Verification:** `pnpm exec tsc --noEmit` passes.

---

## Phase 3: Service Unit Tests + Implementation (TDD)

### Task 3.1: Write failing unit tests for new service behavior (RED)

**File:** `src/recipes/recipes.service.spec.ts`

Write the following tests. They will FAIL until Task 3.2 is done.

**3.1a — Create defaults for new fields:**
```ts
it('creates a recipe with default servings/imageUrl/tags and author', async () => {
  const recipeWithAuthor = {
    ...baseRecipe,
    servings: null,
    imageUrl: null,
    tags: [],
    author: { id: 'user_1', name: 'Alice', image: null },
  }
  prisma.recipe.create.mockResolvedValue(recipeWithAuthor)

  const result = await service.create('user_1', { title: 'Pasta' })

  expect(result).toMatchObject({
    servings: null,
    imageUrl: null,
    tags: [],
    author: { id: 'user_1', name: 'Alice', image: null },
  })
  // verify select includes author select shape
  expect(prisma.recipe.create).toHaveBeenCalledWith(
    expect.objectContaining({
      data: expect.objectContaining({
        title: 'Pasta',
        description: null,
        status: 'DRAFT',
        authorId: 'user_1',
        servings: undefined,
        imageUrl: undefined,
        tags: undefined,
      }),
      select: expect.objectContaining({
        author: { select: { id: true, name: true, image: true } },
      }),
    }),
  )
})
```

**3.1b — Create explicit content fields:**
```ts
it('creates a recipe with explicit servings, imageUrl, and tags', async () => {
  const recipeWithFields = {
    ...baseRecipe,
    servings: 4,
    imageUrl: 'https://example.com/img.jpg',
    tags: ['italian', 'quick'],
    author: { id: 'user_1', name: null, image: null },
  }
  prisma.recipe.create.mockResolvedValue(recipeWithFields)

  const result = await service.create('user_1', {
    title: 'Pasta',
    servings: 4,
    imageUrl: 'https://example.com/img.jpg',
    tags: ['italian', 'quick'],
  })

  expect(result).toMatchObject({
    servings: 4,
    imageUrl: 'https://example.com/img.jpg',
    tags: ['italian', 'quick'],
  })
})
```

**3.1c — List owner/public includes author select:**
```ts
it('list queries include author profile select', async () => {
  const recipeWithAuthor = {
    ...baseRecipe,
    servings: null,
    imageUrl: null,
    tags: [],
    author: { id: 'user_1', name: 'Alice', image: null },
  }
  prisma.recipe.findMany.mockResolvedValue([recipeWithAuthor])

  const result = await service.findAllByOwner('user_1')

  expect(result[0]).toHaveProperty('author')
  expect(result[0]).toHaveProperty('servings')
  expect(result[0]).toHaveProperty('tags')
  expect(result[0]).not.toHaveProperty('authorId')
  // select shape includes author sub-select
  expect(prisma.recipe.findMany).toHaveBeenCalledWith(
    expect.objectContaining({
      select: expect.objectContaining({
        author: { select: { id: true, name: true, image: true } },
      }),
    }),
  )
})
```

**3.1d — Detail response includes author:**
```ts
it('detail query includes author profile in response', async () => {
  const recipeWithAuthor = {
    ...baseRecipe,
    status: 'PUBLIC',
    servings: 4,
    imageUrl: 'https://example.com/img.jpg',
    tags: ['dinner'],
    author: { id: 'user_1', name: 'Alice', image: 'https://example.com/alice.jpg' },
  }
  prisma.recipe.findUnique.mockResolvedValue(recipeWithAuthor)

  const result = await service.findOneOrNotFound('recipe_1', null)

  expect(result).toMatchObject({
    author: { id: 'user_1', name: 'Alice', image: 'https://example.com/alice.jpg' },
    servings: 4,
    imageUrl: 'https://example.com/img.jpg',
    tags: ['dinner'],
  })
  // authorId is selected for canRead but NOT returned
  expect(result).not.toHaveProperty('authorId')
})
```

**3.1e — Update maps only provided content fields:**
```ts
it('update maps provided content fields without touching omitted ones', async () => {
  prisma.recipe.findFirst.mockResolvedValue(baseRecipe)
  prisma.recipe.update.mockResolvedValue({
    ...baseRecipe,
    servings: 6,
    imageUrl: 'https://example.com/new.jpg',
    tags: ['updated'],
    author: { id: 'user_1', name: 'Alice', image: null },
  })

  await service.update('recipe_1', 'user_1', { servings: 6, imageUrl: 'https://example.com/new.jpg', tags: ['updated'] })

  expect(prisma.recipe.update).toHaveBeenCalledWith(
    expect.objectContaining({
      data: expect.objectContaining({ servings: 6, imageUrl: 'https://example.com/new.jpg', tags: ['updated'] }),
    }),
  )
})
```

**3.1f — Update clearing optional content fields:**
```ts
it('update clears optional content fields when null or empty array is provided', async () => {
  prisma.recipe.findFirst.mockResolvedValue(baseRecipe)
  prisma.recipe.update.mockResolvedValue({
    ...baseRecipe,
    servings: null,
    imageUrl: null,
    tags: [],
    author: { id: 'user_1', name: 'Alice', image: null },
  })

  const result = await service.update('recipe_1', 'user_1', {
    servings: null,
    imageUrl: null,
    tags: null,
  })

  expect(result).toMatchObject({ servings: null, imageUrl: null, tags: [] })
  expect(prisma.recipe.update).toHaveBeenCalledWith(
    expect.objectContaining({
      data: expect.objectContaining({ servings: null, imageUrl: null, tags: [] }),
    }),
  )
})
```

**3.1g — Tags empty-array coercion (defensive):**
```ts
it('coerces null tags to empty array in list response', async () => {
  // Simulate a record where tags came back as null (shouldn't happen, but defensive)
  const weirdRecipe = {
    ...baseRecipe,
    servings: null,
    imageUrl: null,
    tags: null,
    author: { id: 'user_1', name: 'Alice', image: null },
  }
  prisma.recipe.findMany.mockResolvedValue([weirdRecipe])

  const result = await service.findAllByOwner('user_1')

  expect(result[0].tags).toEqual([])
})
```

**Verification:** Run `pnpm exec jest src/recipes/recipes.service.spec.ts --runInBand`. All new tests should FAIL (RED).

---

### Task 3.2: Implement service changes to make unit tests pass (GREEN)

**File:** `src/recipes/recipes.service.ts`

**3.2a — Add `authorSelect` and update `listSelect` / `detailSelect`:**

Add static select shapes (next to existing ones):

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
  author: { select: RecipesService.authorSelect },
} as const
```

**3.2b — Update service types:**

Update `RecipeListItem` to include `servings: number | null, imageUrl: string | null, tags: string[], author: { id: string; name: string | null; image: string | null }`.

Update `RecipeResponse` to extend updated `RecipeListItem` with `updatedAt`.

Update `RecipeRecord` to extend updated `RecipeResponse` with `authorId`.

**3.2c — Update `create` method:**

Add `servings`, `imageUrl`, and `tags` to the `data` object:

```ts
data: {
  title: dto.title,
  description: dto.description ?? null,
  servings: dto.servings ?? null,
  imageUrl: dto.imageUrl ?? null,
  tags: dto.tags ?? [],
  status: dto.status ?? RecipeStatus.DRAFT,
  authorId: ownerId,
},
```

Also pass `select: RecipesService.detailSelect` in the `create` call (currently uses no `select`, returning the whole record — but without `select`, author won't be nested).

**3.2d — Update `update` method:**

Use `select: RecipesService.detailSelect` in the `update` call. Update `toUpdateData` to handle the new fields:

```ts
if (dto.servings !== undefined) {
  data.servings = dto.servings
}
if (dto.imageUrl !== undefined) {
  data.imageUrl = dto.imageUrl
}
if (dto.tags !== undefined) {
  data.tags = dto.tags
}
```

**3.2e — Update `toRecipeListItem` to include new fields and author:**

```ts
private toRecipeListItem(recipe: RecipeListItem): RecipeListItem {
  return {
    id: recipe.id,
    title: recipe.title,
    description: recipe.description,
    servings: recipe.servings,
    imageUrl: recipe.imageUrl,
    tags: recipe.tags ?? [],
    status: recipe.status,
    createdAt: recipe.createdAt,
    author: recipe.author,
  }
}
```

**3.2f — Remove `authorId` from response:**

`toRecipeResponse` already calls `toRecipeListItem` and adds `updatedAt`. Ensure it does NOT include `authorId`.

**Verification:** Run `pnpm exec jest src/recipes/recipes.service.spec.ts --runInBand`. All tests should PASS (GREEN).

---

### Task 3.3: Verify existing unit tests still pass

Run full unit suite:

```bash
pnpm run test
```

Ensure no regressions in other test files. Fix any type errors exposed.

---

## Phase 4: E2E Tests (TDD)

### Task 4.1: Write failing e2e tests for content fields and author (RED)

**File:** `test/recipes.e2e-spec.ts`

**4.1a — Update types and fake Prisma:**

1. Add `servings` (`number | null`), `imageUrl` (`string | null`), `tags` (`string[]`), and `author` (`{ id: string; name: string | null; image: string | null }`) to `StoredRecipe`.
2. Update `RecipeBody` to include the same fields.
3. Update `seedRecipe` defaults to include `servings: null`, `imageUrl: null`, `tags: []`, and `author: { id: overrides.authorId ?? 'user_1', name: null, image: null }`.
4. Update the fake `create` to accept `data.servings`, `data.imageUrl`, `data.tags`.
5. Update the fake `update` data type to include new fields.

**4.1b — Add content field tests:**

- `'creates recipe with servings, imageUrl, and tags'` — POST with all fields, assert 201 and full response shape including author.
- `'rejects servings <= 0 with 400'` — POST `{ title: "Pasta", servings: 0 }` → 400.
- `'rejects servings = -1 with 400'` — POST `{ title: "Pasta", servings: -1 }` → 400.
- `'rejects non-integer servings with 400'` — POST `{ title: "Pasta", servings: 2.5 }` → 400.
- `'rejects invalid imageUrl with 400'` — POST `{ title: "Pasta", imageUrl: "not-a-url" }` → 400.
- `'rejects empty tag strings with 400'` — POST `{ title: "Pasta", tags: ["", "  "] }` → 400.
- `'rejects too many tags (>20) with 400'` — POST with 21 tags → 400.
- `'rejects tags that are not an array with 400'` — POST `{ title: "Pasta", tags: "not-array" }` → 400.

**4.1c — Add author profile tests:**

- `'list response includes author profile'` — verify list responses have `author: { id, name, image }` and do NOT have top-level `authorId`.
- `'detail response includes author profile'` — same for detail.
- `'public list includes author profile for public recipes'` — same for public endpoint.

**4.1d — Add update content field tests:**

- `'updates servings, imageUrl, and tags'` — PATCH with new values, assert 200 with updated fields.
- `'clears optional content fields on update'` — seed recipe with content fields, PATCH `{ servings: null, imageUrl: null, tags: null }`, assert `servings: null`, `imageUrl: null`, and `tags: []`.

**4.1e — Tags empty-array defaults in create:**

- `'create without tags defaults to empty array in response'` — POST without `tags`, assert `tags: []`.

**4.1f — Visibility unchanged tests:**

- `'hides private recipe detail from anonymous users'` — still works, but now asserts response includes `author` and new scalar fields.
- Update existing tests that assert response shape (`toMatchObject`) to not break on new fields.

**Verification:** Run `pnpm run test:e2e`. These should FAIL (RED) because the fake Prisma types aren't fully wired yet or the DTOs aren't reflected.

---

### Task 4.2: Verify e2e tests pass after service implementation (GREEN)

After Tasks 3.2 and 4.1 are both done, e2e tests should pass since:

- The fake Prisma can already return the new fields (we updated types in 4.1a).
- The real DTOs are already updated (Phase 2).
- The real service is already updated (Phase 3).

Run:

```bash
pnpm run test:e2e
```

All e2e tests should PASS. If not, debug and fix.

---

### Task 4.3: Update OpenAPI e2e snapshot (app.e2e-spec.ts)

**File:** `test/app.e2e-spec.ts`

Add assertions for the new fields in the `'/docs-json (GET) exposes the frontend API contract'` test:

**4.3a — `CreateRecipeDto` schema additions:**

In the `CreateRecipeDto` section of the schema assertions, verify:

```ts
servings: expectObjectContaining({ type: 'integer', nullable: true, minimum: 1 }),
imageUrl: expectObjectContaining({ type: 'string', nullable: true }),
tags: expectObjectContaining({ type: 'array', items: expectObjectContaining({ type: 'string' }) }),
```

**4.3b — `RecipeResponseDto` and `RecipeListItemDto` schema additions:**

Verify:

```ts
servings: expectObjectContaining({ type: 'integer', nullable: true }),
imageUrl: expectObjectContaining({ type: 'string', nullable: true }),
tags: expectObjectContaining({ type: 'array', items: expectObjectContaining({ type: 'string' }) }),
author: jsonSchemaRef('RecipeAuthorDto'),
```

**4.3c — `RecipeAuthorDto` schema:**

Verify the component exists:

```ts
RecipeAuthorDto: {
  properties: {
    id: expectObjectContaining({ type: 'string' }),
    name: expectObjectContaining({ type: 'string', nullable: true }),
    image: expectObjectContaining({ type: 'string', nullable: true }),
  },
},
```

**Verification:** Run `pnpm run test:e2e`. The OpenAPI test may FAIL (RED) if the `type: 'integer'` vs `type: 'number'` Swagger mapping differs. Adjust assertions to match actual Swagger output, then verify GREEN.

---

## Phase 5: Final Verification

### Task 5.1: Full quality gate

Run in order:

```bash
pnpm exec tsc --noEmit                                 # TypeScript compilation
pnpm exec jest --runInBand                              # All unit tests
pnpm exec jest --config ./test/jest-e2e.json --runInBand # All e2e tests (including OpenAPI)
pnpm run lint                                           # ESLint
pnpm run build                                          # Production build
```

All commands must pass with zero errors.

---

## Deferred (explicitly out of scope for this change)

- `ingredients` and `steps` child tables with ordering
- Nested create/update for ingredients/steps
- Detail-only expansion for ingredient/step arrays
- Search/filter by tags
- AI generation/parsing/enrichment
- Frontend/UI
- Recipe deletion or lifecycle changes
- Comments, ratings, sharing, nutrition, timers, media upload/storage

---

## Summary of files changed

| File | Change |
|------|--------|
| `prisma/schema.prisma` | +3 fields on `Recipe` |
| `prisma/migrations/*_recipe_content/migration.sql` | Generated migration |
| `src/generated/prisma/` | Regenerated client (not reviewed) |
| `src/recipes/dto/recipe-response.dto.ts` | +`RecipeAuthorDto`, extend list/detail DTOs |
| `src/recipes/dto/create-recipe.dto.ts` | +`servings`, `imageUrl`, `tags` validation |
| `src/recipes/dto/update-recipe.dto.ts` | +`servings`, `imageUrl`, `tags` validation |
| `src/recipes/recipes.service.ts` | +selects, author, field mapping |
| `src/recipes/recipes.service.spec.ts` | +7 test cases |
| `test/recipes.e2e-spec.ts` | +types, fake Prisma, +~12 test cases |
| `test/app.e2e-spec.ts` | +OpenAPI schema assertions |

---

## Apply Progress

- [x] Prisma schema updated with `servings`, `imageUrl`, and `tags`.
- [x] Prisma migration generated and applied (`20260705020312_recipe_content`).
- [x] Prisma client regenerated.
- [x] Response DTOs updated with `RecipeAuthorDto`, content fields, and explicit Swagger types.
- [x] Create/Update DTOs updated for content validation and null-clearing semantics.
- [x] `RecipesService` updated for author selects, explicit selects, and content field mapping.
- [x] Service unit tests updated and passing, including null-clearing coverage.
- [x] E2E recipe tests updated and passing.
- [x] OpenAPI e2e assertions updated and passing.
- [x] Verification commands completed: `pnpm exec prisma validate`, `pnpm run test`, `pnpm exec jest --config ./test/jest-e2e.json --runInBand`, `pnpm run build`.

---

## Implementation progress (2026-07-04)

- [x] Prisma schema adds `servings`, `imageUrl`, and `tags` to `Recipe`.
- [x] Prisma migration `20260705020312_recipe_content` created and reviewed.
- [x] Prisma client regenerated with the new `Recipe` fields.
- [x] `RecipeAuthorDto` added and recipe response DTOs now include `servings`, `imageUrl`, `tags`, and `author`.
- [x] `CreateRecipeDto` and `UpdateRecipeDto` validate `servings`, `imageUrl`, and `tags`.
- [x] `RecipesService` returns author profile data and content fields in list/detail/create/update responses.
- [x] Unit tests for the recipe-content slice pass.
- [x] E2E tests for the recipe-content slice pass.
- [x] OpenAPI assertions include the new recipe-content contract.
- [ ] Deferred: ingredients, steps, nested writes, AI generation, search/filtering by tags.
- [ ] Deferred: frontend/UI and media upload/storage.
