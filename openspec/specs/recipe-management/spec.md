# recipe-management Specification

## Purpose

Define the API contract for recipe lifecycle: create, list, view detail, update owned recipes with status-based visibility (`DRAFT | PRIVATE | PUBLIC`), scalar content metadata (`servings`, `imageUrl`, `tags`), and author profile data in responses. Ingredients, steps, deletion, and AI features are out of scope.

## Requirements

### Requirement: Create Recipe

The system MUST allow authenticated users to create a recipe with a required `title` and optional `description`, `servings`, `imageUrl`, `tags`, and `status`. Status MUST default to `DRAFT` when not provided. The recipe MUST be linked to the authenticated user as owner.

| Field | Required | Default | Constraints |
|-------|----------|---------|-------------|
| title | Yes | — | Non-empty string, max 200 chars |
| description | No | null | String, max 2000 chars |
| servings | No | null | Positive integer (≥1) |
| imageUrl | No | null | Valid URL string |
| tags | No | [] | Array of non-empty strings; defaults to empty array in response |
| status | No | DRAFT | One of: DRAFT, PRIVATE, PUBLIC |

#### Scenario: Create recipe with minimal fields

- GIVEN an authenticated user
- WHEN they POST a recipe with `{ title: "Pasta" }`
- THEN the system creates a recipe with status `DRAFT`, owned by the user
- AND returns 201 with the created recipe
- AND the response includes `servings: null`, `imageUrl: null`, `tags: []`, and `author: { id, name, image }`

#### Scenario: Create recipe with all content fields

- GIVEN an authenticated user
- WHEN they POST a recipe with `{ title: "Pasta", servings: 4, imageUrl: "https://example.com/pasta.jpg", tags: ["italian", "quick"], status: "PUBLIC" }`
- THEN the system creates a recipe with all fields populated
- AND returns 201 with `servings: 4`, `imageUrl: "https://example.com/pasta.jpg"`, `tags: ["italian", "quick"]`

#### Scenario: Create recipe with explicit status

- GIVEN an authenticated user
- WHEN they POST a recipe with `{ title: "Secret", status: "PRIVATE" }`
- THEN the system creates a recipe with status `PRIVATE`

#### Scenario: Create recipe fails validation

- GIVEN an authenticated user
- WHEN they POST a recipe with an empty `title` or `title` exceeding 200 chars
- THEN the system returns 400 with validation error details

#### Scenario: Create recipe with invalid servings

- GIVEN an authenticated user
- WHEN they POST a recipe with `{ title: "Pasta", servings: 0 }` or `{ title: "Pasta", servings: -1 }`
- THEN the system returns 400 with validation error details

#### Scenario: Create recipe with invalid imageUrl

- GIVEN an authenticated user
- WHEN they POST a recipe with `{ title: "Pasta", imageUrl: "not-a-url" }`
- THEN the system returns 400 with validation error details

#### Scenario: Create recipe with invalid tags

- GIVEN an authenticated user
- WHEN they POST a recipe with `{ title: "Pasta", tags: ["", "  "] }` (empty/whitespace-only strings)
- THEN the system returns 400 with validation error details

#### Scenario: Create recipe unauthenticated

- GIVEN no authenticated user (anonymous)
- WHEN they POST a recipe
- THEN the system returns 401 Unauthorized

---

### Requirement: List My Recipes

The system MUST allow authenticated users to list all recipes they own, regardless of status. The response MUST include `id`, `title`, `description`, `servings`, `imageUrl`, `tags`, `status`, `createdAt`, and `author` (`id`, `name`, `image`) for each recipe. Ingredients and steps MUST NOT be included.

#### Scenario: Owner lists their recipes

- GIVEN an authenticated user with 3 recipes (one each DRAFT, PRIVATE, PUBLIC)
- WHEN they GET `/recipes`
- THEN the system returns 200 with all 3 recipes
- AND each recipe includes `servings`, `imageUrl`, `tags`, and `author` fields

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

The system MUST allow any user (anonymous or authenticated) to list only recipes with status `PUBLIC`. Recipes with status `DRAFT` or `PRIVATE` MUST NOT appear in this listing. The response MUST include the same fields as List My Recipes. Ingredients and steps MUST NOT be included.

#### Scenario: Anonymous user lists public recipes

- GIVEN 5 recipes exist (2 PUBLIC, 2 PRIVATE, 1 DRAFT)
- WHEN an anonymous user GETs `/recipes/public`
- THEN the system returns 200 with only the 2 PUBLIC recipes
- AND each recipe includes `servings`, `imageUrl`, `tags`, and `author` fields

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

The system MUST return full recipe detail for recipes with status `PUBLIC` to any user. For `DRAFT` and `PRIVATE` recipes, the system MUST return 404 Not Found to non-owners, including anonymous users. The owner MUST be able to view their own recipes regardless of status. The response MUST include `id`, `title`, `description`, `servings`, `imageUrl`, `tags`, `status`, `createdAt`, `updatedAt`, and nested `author` (`id`, `name`, `image`).

#### Scenario: Anyone views a public recipe

- GIVEN a recipe with status PUBLIC owned by user A
- WHEN user B (or anonymous) GETs `/recipes/{id}`
- THEN the system returns 200 with the full recipe including all content fields and author profile

#### Scenario: Owner views their own private recipe

- GIVEN user A owns a recipe with status PRIVATE
- WHEN user A GETs `/recipes/{id}`
- THEN the system returns 200 with the full recipe including all content fields and author profile

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

The system MUST allow the recipe owner to update `title`, `description`, `servings`, `imageUrl`, `tags`, and `status` fields. Non-owners and anonymous users MUST receive 404 Not Found when attempting to update. Partial updates MUST be supported. The recipe owner MUST NOT change.

| Field | Updatable | Constraints |
|-------|-----------|-------------|
| title | Yes | Non-empty string, max 200 chars |
| description | Yes | String or null, max 2000 chars |
| servings | Yes | Positive integer (≥1) or null |
| imageUrl | Yes | Valid URL string or null |
| tags | Yes | Array of non-empty strings or null to clear |
| status | Yes | One of: DRAFT, PRIVATE, PUBLIC |

#### Scenario: Owner updates recipe title

- GIVEN user A owns a recipe with title "Old"
- WHEN user A PATCHes `/recipes/{id}` with `{ title: "New" }`
- THEN the system returns 200 with the updated recipe

#### Scenario: Owner updates content fields

- GIVEN user A owns a recipe
- WHEN user A PATCHes `/recipes/{id}` with `{ servings: 6, imageUrl: "https://example.com/img.jpg", tags: ["dinner"] }`
- THEN the system returns 200 with the updated content fields

#### Scenario: Owner clears optional content fields

- GIVEN user A owns a recipe with `servings: 4`, `imageUrl: "https://example.com/img.jpg"`, `tags: ["lunch"]`
- WHEN user A PATCHes `/recipes/{id}` with `{ servings: null, imageUrl: null, tags: null }`
- THEN the system returns 200 with `servings: null`, `imageUrl: null`, `tags: []`

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

#### Scenario: Update with invalid content fields returns 400

- GIVEN user A owns a recipe
- WHEN they PATCH `/recipes/{id}` with `{ servings: 0 }` or `{ imageUrl: "not-a-url" }` or `{ tags: [""] }`
- THEN the system returns 400 Bad Request with validation error details

---

### Requirement: Recipe Author in Responses

The system MUST include a nested `author` object in every recipe response (list and detail). The `author` object MUST contain `id` (string), `name` (string or null), and `image` (string or null), sourced from the recipe's `author` relation.

#### Scenario: Recipe response includes author with name and image

- GIVEN a recipe owned by a user with `name: "Alice"` and `image: "https://example.com/alice.jpg"`
- WHEN the recipe is returned in any response (list or detail)
- THEN the response includes `author: { id: "...", name: "Alice", image: "https://example.com/alice.jpg" }`

#### Scenario: Recipe response includes author without name or image

- GIVEN a recipe owned by a user with `name: null` and `image: null`
- WHEN the recipe is returned in any response
- THEN the response includes `author: { id: "...", name: null, image: null }`

---

### Requirement: Tags Empty-Array Semantics

The system MUST represent an empty or absent `tags` field as an empty array `[]` in all API responses. Tags MUST never be serialized as `null`. When `tags` is omitted during creation, the stored value MUST produce `[]` in responses.

#### Scenario: Create recipe without tags returns empty array

- GIVEN an authenticated user
- WHEN they POST a recipe without providing `tags`
- THEN the response includes `tags: []`

#### Scenario: Update recipe clears tags to empty array

- GIVEN a recipe with `tags: ["italian"]`
- WHEN the owner PATCHes the recipe with `{ tags: null }` to clear
- THEN the response includes `tags: []`

#### Scenario: Recipe detail with no tags returns empty array

- GIVEN a recipe stored with no tags
- WHEN the recipe detail is requested
- THEN the response includes `tags: []`, not `tags: null`

---

### Requirement: Response Shape Consistency Across List and Detail

The system MUST include the same scalar content fields (`servings`, `imageUrl`, `tags`) and `author` profile in both list and detail responses. The detail response MUST additionally include `updatedAt`. This consistency MUST hold across all recipe endpoints: `GET /recipes`, `GET /recipes/public`, `GET /recipes/:id`, `POST /recipes` (201), and `PATCH /recipes/:id` (200).

#### Scenario: List and detail share the same scalar content shape

- GIVEN a recipe with `servings: 4`, `imageUrl: "https://example.com/img.jpg"`, `tags: ["quick"]`
- WHEN the recipe appears in a list response
- AND when the same recipe is fetched as detail
- THEN both responses include the same values for `servings`, `imageUrl`, `tags`, and `author`
- AND the detail response additionally includes `updatedAt`

#### Scenario: Create and update responses match the consistent shape

- GIVEN an authenticated user
- WHEN they create a recipe
- AND when they update that recipe
- THEN both the 201 and 200 responses follow the same shape as list/detail responses

---

### Requirement: OpenAPI Contract Reflects Content Fields

The system MUST expose the new scalar content fields and author profile through OpenAPI (Swagger) metadata so that generated frontend types include `servings`, `imageUrl`, `tags`, and `author`. The `RecipeListItemDto` and `RecipeResponseDto` classes MUST carry `@ApiProperty` decorators for all new fields.

#### Scenario: OpenAPI spec includes content fields

- GIVEN the application is running
- WHEN the OpenAPI JSON is generated (e.g., via `/api-json` or build-time extraction)
- THEN the `RecipeListItemDto` and `RecipeResponseDto` schemas include `servings` (integer, nullable), `imageUrl` (string, nullable), `tags` (array of strings), and `author` (object with `id`, `name`, `image`)
