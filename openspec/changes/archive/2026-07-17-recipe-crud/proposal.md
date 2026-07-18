# Proposal: Recipe CRUD

## Intent

Give authenticated users a minimal recipe workspace: create recipes, keep drafts/private work hidden, publish recipes publicly, and edit basic metadata. The current `Recipe` model exists but has no API contract, and `isPublic` cannot represent `draft`, `private`, and `public` distinctly.

## Scope

### In Scope
- Create authenticated recipes with `title`, optional `description`, and visibility/status.
- List my recipes, including draft/private/public owned recipes.
- List public recipes for anonymous and authenticated users.
- Get recipe detail with access rules: public visible to anyone; private/draft visible only to owner.
- Update owned recipe `title`, `description`, and visibility/status.

### Out of Scope
- Ingredients, preparation steps, media, tags, search, ratings, comments, and sharing links.
- Recipe deletion; defer to a later lifecycle decision.
- Frontend/UI work.

## Capabilities

### New Capabilities
- `recipe-management`: Recipe create, list, detail, update, and visibility access rules.

### Modified Capabilities
- None.

## Approach

Add a NestJS `RecipesModule` with controller/service boundaries, DTO validation, Prisma-backed persistence, and Auth.js session-based ownership checks. API surface should cover high-level routes for create recipe, list my recipes, list public recipes, get recipe detail, and update owned recipe.

Design/spec should replace or augment `Recipe.isPublic` with a status enum such as `DRAFT | PRIVATE | PUBLIC`, preserving existing rows through a safe migration rule.

## Affected Areas

| Area | Impact | Description |
|------|--------|-------------|
| `src/recipes/` | New | Controller, service, DTOs, and tests. |
| `prisma/schema.prisma` | Modified | Recipe visibility/status model. |
| `src/auth/` | Modified | Reuse current session user identity for owner-only routes. |
| `test/` | Modified | E2E coverage for anonymous, owner, and non-owner access. |

## Risks

| Risk | Likelihood | Mitigation |
|------|------------|------------|
| Boolean visibility cannot model draft/private/public | High | Introduce explicit status enum in design/spec. |
| Access-control leak for private/draft recipes | Medium | Centralize permission checks and cover owner/non-owner/anonymous tests. |
| Migration changes existing visibility semantics | Medium | Map `isPublic=true` to `PUBLIC`; `false` to `PRIVATE` unless design chooses `DRAFT`. |

## Rollback Plan

Revert the recipe module, route registrations, tests, and Prisma migration. If the status migration shipped, migrate `PUBLIC` back to `is_public=true` and all other statuses to `false` before reverting schema.

## Dependencies

- Existing Auth.js session with `session.user.id`.
- Existing Prisma/Postgres setup and `Recipe.authorId` relation.

## Open Questions

- Should existing `isPublic=false` recipes become `PRIVATE` or `DRAFT` during migration?
- Should public list pagination be required in the first slice?

## Success Criteria

- [ ] Authenticated users can create, list, view, and update owned recipes.
- [ ] Anonymous users can list/view public recipes only.
- [ ] Private and draft recipes are inaccessible to non-owners.
