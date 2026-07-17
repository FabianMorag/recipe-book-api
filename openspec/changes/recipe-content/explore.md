# Explore: recipe-content

## Goal
Add real backend recipe content fields after confirming `recipes.status` is migrated and stable. This change explicitly excludes AI features.

## Existing behavior
- `Recipe` currently stores `id`, `title`, `description`, `status` (`DRAFT`, `PRIVATE`, `PUBLIC`), `authorId`/`author`, `createdAt`, and `updatedAt`.
- `RecipesService` owns visibility rules: public recipes are readable by everyone; non-public recipes are owner-only.
- Routes include `POST /recipes`, `GET /recipes`, `GET /recipes/public`, `GET /recipes/:id`, and `PATCH /recipes/:id`.
- Response DTOs and Prisma `select` shapes are tightly coupled in the service.

## Candidate scope
- `servings`
- `imageUrl`
- `tags`
- `ingredients`
- `steps`
- author/profile data in responses
- real recipe detail response

## Affected areas
- `prisma/schema.prisma` and a new migration
- `src/recipes/dto/create-recipe.dto.ts`
- `src/recipes/dto/update-recipe.dto.ts`
- `src/recipes/dto/recipe-response.dto.ts`
- `src/recipes/recipes.service.ts`
- `src/recipes/recipes.controller.ts` only if route/Swagger metadata needs adjustment
- `src/recipes/recipes.service.spec.ts`
- `test/recipes.e2e-spec.ts`
- `test/app.e2e-spec.ts`
- generated Prisma client after migration/generate

## API/OpenAPI implications
- New DTO properties surface through Swagger decorators.
- Add a dedicated author/profile DTO for recipe responses, e.g. `RecipeAuthorDto` with `id`, `name`, and `image`.
- Keep list responses lighter than detail responses if ingredients/steps become large.

## DB/schema implications
- Scalar fields can live on `Recipe`: `servings`, `image_url`, and `tags`.
- `ingredients` and `steps` should likely be normalized child tables with stable ordering.
- Prisma selectors must include nested `author` profile fields for detail responses.

## Suggested slicing
1. Scalar content + author profile: `servings`, `imageUrl`, `tags`, author DTO, migration, tests.
2. Ingredients and steps: normalized child models, nested DTO validation, nested writes, detailed response.

Given the user's current preference (`single-pr-default`, 700 changed-line budget), the proposal should decide whether both slices fit in one PR or whether ingredients/steps should be delayed to a second change.

## Test map
- Service specs for create/update with new fields, defaults, and author profile mapping.
- E2E specs for validation failures, anonymous vs owner detail visibility, and OpenAPI schema shape.
- Build and Prisma generate after migration.

## Risks
- Ingredients/steps plus scalar fields may exceed review budget.
- Nested array validation needs `@Type`/`ValidateNested` and careful whitelist behavior.
- Decide empty-array vs `null` semantics for `tags`, `ingredients`, and `steps`.
- Fake Prisma/test fixtures must track selected fields exactly.
