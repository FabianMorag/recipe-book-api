# Apply Progress: recipe-content

## Status
Implemented first backend slice and addressed fresh-review findings.

## Completed
- Added Prisma scalar fields to `Recipe`: `servings`, `imageUrl`, `tags`.
- Created migration `20260705020312_recipe_content` with `tags TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[]`.
- Regenerated Prisma Client.
- Added DTO validation and Swagger metadata for scalar fields.
- Added `RecipeAuthorDto` and nested author profile response shape.
- Updated `RecipesService` explicit selects and response mapping.
- Added/updated unit tests, e2e tests, and OpenAPI contract assertions.
- Preserved existing status and visibility behavior.
- Added validation coverage for `tags: null` on create and `title: null` / `status: null` on update.
- Deferred ingredients, steps, AI, frontend, search/filter, and media upload.

## Verification
- `pnpm exec prisma migrate status` — passed; 3 migrations found and database schema is up to date.
- `pnpm exec tsc --noEmit` — passed.
- `pnpm exec jest --runInBand` — passed: 5 suites, 35 tests.
- `pnpm exec jest --config ./test/jest-e2e.json --runInBand` — passed: 2 suites, 18 tests.
- `pnpm run lint` — passed.
- `pnpm run build` — passed.

## TDD Cycle Evidence

| Cycle | RED evidence | GREEN evidence | Triangulation / refactor evidence |
|-------|--------------|----------------|-----------------------------------|
| Prisma schema + migration | Prior service/API tests referenced fields before schema/client support during the interrupted apply, producing compile-broken RED. | Added `servings`, `imageUrl`, and non-null/defaulted `tags`; generated/applied `20260705020312_recipe_content`; `pnpm exec prisma migrate status` passed. | Review found the first generated SQL allowed nullable `tags`; migration SQL was corrected before commit to `TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[]`. |
| DTO validation + OpenAPI | E2E/OpenAPI assertions required scalar fields, author DTO, invalid content validation, `tags: null` rejection on create, and null title/status rejection on update before final decorator fixes. | `pnpm exec jest --config ./test/jest-e2e.json --runInBand` passed with 18 tests. | Swagger nullable union metadata initially emitted `type: object`; explicit `type: Number/String` decorators fixed the contract. |
| Service mapping + response shape | `src/recipes/recipes.service.spec.ts` added expectations for create/update/list/detail scalar fields, author profile, authorId omission, and tag null defensive coercion before service implementation was complete. | `pnpm exec jest src/recipes/recipes.service.spec.ts --runInBand` passed; full unit suite passed with 35 tests. | Fresh review found null-clearing/validation gaps; service and DTO behavior were tightened and covered by e2e tests. |
| API visibility preservation | E2E tests covered public list/detail, owner list/update, private/draft hiding, and author/content response shape through HTTP. | E2E suite passed after fake Prisma and DTO/service wiring were aligned. | Visibility rules stayed centralized in `RecipesService`; no controller route changes or deferred ingredients/steps/AI were introduced. |
| Final quality gate | N/A — final verification is GREEN evidence for the completed cycles. | `pnpm exec tsc --noEmit`, `pnpm run lint`, `pnpm exec jest --runInBand`, `pnpm exec jest --config ./test/jest-e2e.json --runInBand`, `pnpm run build`, and `pnpm exec prisma migrate status` passed. | `sdd-verify` additionally ran coverage and `git diff --check`; implementation is green, with review-budget overrun documented. |

## Review notes
- Reliability/risk review found null-validation and `tags` nullability risks.
- Fixes applied: `ValidateIf(... !== undefined)` rejects null where the contract requires it, e2e tests cover the cases, and the migration SQL now matches the non-null tags contract.
- The feature exceeded the original 700-line budget once tests/OpenSpec are included; readability review recommends careful review or future split discipline.
