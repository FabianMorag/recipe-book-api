# Proposal: Recipe Content

## Intent

Make recipes useful beyond title/description by adding backend-owned content fields and richer response shape for the next frontend iteration, while keeping the existing recipe visibility model stable. This change is backend-first so OpenAPI/types can be regenerated before frontend work begins. AI-assisted recipe generation is explicitly out of scope.

## Skill Resolution

- `skill_resolution`: `paths-injected`
- Loaded skills:
  - `.agents/skills/nestjs-best-practices/SKILL.md`
  - `.agents/skills/prisma-cli/SKILL.md`
  - `.agents/skills/prisma-client-api/SKILL.md`

## Scope

### In Scope: First Backend Slice

- Add scalar recipe content fields:
  - `servings`: optional positive integer serving count.
  - `imageUrl`: optional URL for a recipe image.
  - `tags`: optional list of short labels for filtering/display preparation.
- Add author/profile data to recipe responses, such as `author: { id, name, image }`.
- Keep existing recipe status and visibility rules unchanged:
  - Public recipes are readable by everyone.
  - Draft/private recipes are owner-only.
  - Only owners can update recipes.
- Update create/update DTO validation, response DTOs, Swagger metadata, Prisma select shapes, and tests for the new fields.
- Produce a real recipe detail response that includes the same scalar content and author profile fields expected by generated frontend types.

### Deferred Scope: Second Backend Slice

- Normalized `ingredients` and `steps` child tables with stable ordering.
- Nested create/update semantics for ingredients and steps.
- Detail-only expansion of potentially large ingredient/step arrays.
- Any search/filter behavior that uses `tags`.

### Out of Scope

- AI generation, AI parsing, or AI enrichment of recipe content.
- Frontend/UI implementation.
- Recipe deletion or lifecycle changes.
- Changes to the completed `recipes.status` migration.
- Comments, ratings, sharing links, nutrition, timers, media upload/storage, or moderation workflows.

## User Impact

- Recipe owners can start capturing meaningful recipe metadata needed by the future UI without changing their visibility workflow.
- Anonymous users and non-owners continue to see only public recipes, now with richer display metadata when public.
- Frontend work can rely on generated OpenAPI/types for scalar content and author profile before adding more complex editing UX.

## Product Assumptions

- Empty `tags` should behave as an empty array in API responses rather than `null`.
- Missing optional scalar fields (`servings`, `imageUrl`) may be represented as `null` or omitted according to the existing DTO conventions, but response shape should be consistent across list and detail responses.
- Ingredients and steps are core recipe content, but doing them correctly requires ordering, nested validation, nested writes, and likely separate tables; they should not be squeezed into the first slice as unstructured JSON if normalized content is the target model.
- List responses should stay lighter than detail responses once ingredients and steps are added.

## API and DB Approach

### API

- Extend `CreateRecipeDto` and `UpdateRecipeDto` with validated optional fields for `servings`, `imageUrl`, and `tags`.
- Extend `RecipeResponseDto` with scalar content fields and a nested `RecipeAuthorDto`.
- Keep existing routes unchanged unless Swagger annotations need refinement:
  - `POST /recipes`
  - `GET /recipes`
  - `GET /recipes/public`
  - `GET /recipes/:id`
  - `PATCH /recipes/:id`
- Preserve centralized access-control behavior in `RecipesService`.

### Database / Prisma

- Add scalar fields to `Recipe` with snake_case DB mappings where needed:
  - `servings`
  - `image_url`
  - `tags`
- Use a Prisma migration rather than `db push`.
- Regenerate Prisma Client after the migration during implementation.
- Keep Prisma `select` shapes explicit and aligned with response DTO mapping, including nested author profile selection.

### NestJS Practices

- Keep changes inside the existing recipes feature module boundaries.
- Keep validation at DTO boundaries with class-validator/class-transformer where needed.
- Avoid duplicating access-control checks across controller methods; service-level ownership/visibility logic remains the source of truth.

## Affected Areas

| Area | Impact |
|------|--------|
| `prisma/schema.prisma` | Add scalar content fields and migration metadata. |
| `src/recipes/dto/create-recipe.dto.ts` | Validate new create fields. |
| `src/recipes/dto/update-recipe.dto.ts` | Validate partial updates for new fields. |
| `src/recipes/dto/recipe-response.dto.ts` | Add scalar content and author/profile response DTOs. |
| `src/recipes/recipes.service.ts` | Update Prisma select/data mapping and response mapping. |
| `src/recipes/recipes.controller.ts` | Adjust Swagger metadata only if required by DTO changes. |
| `src/recipes/recipes.service.spec.ts` | Cover create/update/default mapping and author profile mapping. |
| `test/recipes.e2e-spec.ts` | Cover validation, visibility, and response shape. |
| `test/app.e2e-spec.ts` | Update route/OpenAPI expectations if affected. |
| Generated Prisma client | Regenerate after schema migration during implementation. |

## PR Slicing Recommendation

Use a single implementation PR for the first backend slice only: scalar content fields plus author/profile responses. This is the best fit for the 700 changed-line review budget because it touches schema, DTOs, service mapping, Swagger output, unit tests, and e2e tests without adding nested write complexity.

Create a second change/PR for normalized ingredients and steps. Combining both slices in one PR is likely to exceed the review budget and increases risk around nested validation, ordered child records, transactional writes, and response-size decisions.

## Risks and Mitigations

| Risk | Mitigation |
|------|------------|
| Scope creep into ingredients/steps or AI work | Keep first PR limited to scalar fields and author DTO; document second slice separately. |
| Response shape drift between Prisma selects and DTOs | Use explicit select/mapping tests for author and new fields. |
| Ambiguous null vs empty-array behavior for `tags` | Specify empty array semantics in tests and response mapping. |
| Invalid image URLs or tag payloads | Validate DTO inputs and cover validation failures in e2e tests. |
| Migration/client mismatch | Use Prisma migration flow and regenerate Prisma Client before implementation verification. |
| Review budget overrun | Defer normalized child models and nested writes to a second PR. |

## Rollback Plan

- Revert the recipe content migration and code changes if not yet deployed.
- If deployed, ship a down/rollback migration that removes the scalar columns only after confirming no frontend or API consumers depend on them.
- Because existing status/visibility rules are unchanged, rollback does not require recipe lifecycle data conversion.

## Success Criteria

- [ ] Recipe create/update accepts and validates `servings`, `imageUrl`, and `tags`.
- [ ] Recipe list/detail responses include the new scalar fields and author profile data.
- [ ] Existing public/owner-only visibility behavior remains unchanged.
- [ ] OpenAPI output reflects the backend-first contract for future frontend type generation.
- [ ] Unit and e2e coverage includes defaults, validation failures, response mapping, and access-control preservation.
- [ ] Ingredients/steps are clearly deferred to a follow-up normalized-content change.
