# recipe-management Specification

## Purpose

Define the API contract for recipe lifecycle: create, list, view detail, and update owned recipes with status-based visibility (`DRAFT | PRIVATE | PUBLIC`). Ingredients, steps, and deletion are out of scope for this slice.

## Requirements

### Requirement: Create Recipe

The system MUST allow authenticated users to create a recipe with a required `title` and optional `description`. Status MUST default to `DRAFT` when not provided. The recipe MUST be linked to the authenticated user as owner.

| Field | Required | Default | Constraints |
|-------|----------|---------|-------------|
| title | Yes | — | Non-empty string, max 200 chars |
| description | No | null | String, max 2000 chars |
| status | No | DRAFT | One of: DRAFT, PRIVATE, PUBLIC |

#### Scenario: Create recipe with minimal fields

- GIVEN an authenticated user
- WHEN they POST a recipe with `{ title: "Pasta" }`
- THEN the system creates a recipe with status `DRAFT`, owned by the user
- AND returns 201 with the created recipe

#### Scenario: Create recipe with explicit status

- GIVEN an authenticated user
- WHEN they POST a recipe with `{ title: "Secret", status: "PRIVATE" }`
- THEN the system creates a recipe with status `PRIVATE`

#### Scenario: Create recipe fails validation

- GIVEN an authenticated user
- WHEN they POST a recipe with an empty `title` or `title` exceeding 200 chars
- THEN the system returns 400 with validation error details

#### Scenario: Create recipe unauthenticated

- GIVEN no authenticated user (anonymous)
- WHEN they POST a recipe
- THEN the system returns 401 Unauthorized

---

### Requirement: List My Recipes

The system MUST allow authenticated users to list all recipes they own, regardless of status. The response MUST include `id`, `title`, `description`, `status`, and `createdAt` for each recipe. Ingredients and steps MUST NOT be included.

#### Scenario: Owner lists their recipes

- GIVEN an authenticated user with 3 recipes (one each DRAFT, PRIVATE, PUBLIC)
- WHEN they GET `/recipes`
- THEN the system returns 200 with all 3 recipes

#### Scenario: Owner with no recipes

- GIVEN an authenticated user with zero recipes
- WHEN they GET `/recipes`
- THEN the system returns 200 with an empty array

#### Scenario: List my recipes unauthenticated

- GIVEN no authenticated user
- WHEN they GET `/recipes`
- THEN the system returns 401 Unauthorized

---

### Requirement: List Public Recipes

The system MUST allow any user (anonymous or authenticated) to list only recipes with status `PUBLIC`. Recipes with status `DRAFT` or `PRIVATE` MUST NOT appear in this listing. Ingredients and steps MUST NOT be included.

#### Scenario: Anonymous user lists public recipes

- GIVEN 5 recipes exist (2 PUBLIC, 2 PRIVATE, 1 DRAFT)
- WHEN an anonymous user GETs `/recipes/public`
- THEN the system returns 200 with only the 2 PUBLIC recipes

#### Scenario: Authenticated user lists public recipes

- GIVEN an authenticated user (who may own some recipes)
- WHEN they GET `/recipes/public`
- THEN the system returns 200 with all PUBLIC recipes (including their own PUBLIC ones)

#### Scenario: No public recipes exist

- GIVEN no recipes have status PUBLIC
- WHEN any user GETs `/recipes/public`
- THEN the system returns 200 with an empty array

---

### Requirement: Get Recipe Detail

The system MUST return full recipe detail for recipes with status `PUBLIC` to any user. For `DRAFT` and `PRIVATE` recipes, the system MUST return 404 Not Found to non-owners, including anonymous users. The owner MUST be able to view their own recipes regardless of status.

#### Scenario: Anyone views a public recipe

- GIVEN a recipe with status PUBLIC owned by user A
- WHEN user B (or anonymous) GETs `/recipes/{id}`
- THEN the system returns 200 with the full recipe

#### Scenario: Owner views their own private recipe

- GIVEN user A owns a recipe with status PRIVATE
- WHEN user A GETs `/recipes/{id}`
- THEN the system returns 200 with the full recipe

#### Scenario: Non-owner views private recipe gets 404

- GIVEN user A owns a recipe with status PRIVATE
- WHEN user B (authenticated, not owner) GETs `/recipes/{id}`
- THEN the system returns 404 Not Found

#### Scenario: Anonymous views private recipe gets 404

- GIVEN a recipe with status PRIVATE
- WHEN an anonymous user GETs `/recipes/{id}`
- THEN the system returns 404 Not Found

#### Scenario: Non-existent recipe returns 404

- GIVEN no recipe exists with id `nonexistent`
- WHEN any user GETs `/recipes/nonexistent`
- THEN the system returns 404 Not Found

---

### Requirement: Update Recipe

The system MUST allow the recipe owner to update `title`, `description`, and `status` fields. Non-owners and anonymous users MUST receive 404 Not Found when attempting to update. Partial updates MUST be supported. The recipe owner MUST NOT change.

| Field | Updatable | Constraints |
|-------|-----------|-------------|
| title | Yes | Non-empty string, max 200 chars |
| description | Yes | String or null, max 2000 chars |
| status | Yes | One of: DRAFT, PRIVATE, PUBLIC |

#### Scenario: Owner updates recipe title

- GIVEN user A owns a recipe with title "Old"
- WHEN user A PATCHes `/recipes/{id}` with `{ title: "New" }`
- THEN the system returns 200 with the updated recipe

#### Scenario: Owner changes status to PUBLIC

- GIVEN user A owns a recipe with status DRAFT
- WHEN user A PATCHes `/recipes/{id}` with `{ status: "PUBLIC" }`
- THEN the system returns 200 with status now PUBLIC

#### Scenario: Non-owner update returns 404

- GIVEN user A owns a recipe
- WHEN user B PATCHes `/recipes/{id}` with `{ title: "Hijacked" }`
- THEN the system returns 404 Not Found

#### Scenario: Anonymous update returns 401

- GIVEN an anonymous user
- WHEN they PATCH `/recipes/{id}`
- THEN the system returns 401 Unauthorized

#### Scenario: Update with invalid status returns 400

- GIVEN user A owns a recipe
- WHEN they PATCH `/recipes/{id}` with `{ status: "INVALID" }`
- THEN the system returns 400 Bad Request
