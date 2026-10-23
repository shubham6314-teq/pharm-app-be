Backend Development Rules

Tech Stack

. NestJS, TypeScript, Prisma, PostgreSQL.
. Frontend is a separate Next.js application.

Architecture & Structure

. Use a feature-based modular architecture. Each feature must have its own folder under src/modules/.
. Create separate modules, controllers, services, DTOs, and supporting files based on responsibility.
. Keep modules loosely coupled, highly cohesive, and independently maintainable.
. Modules must not directly depend on another module's internal implementation. Communicate through exported providers or clearly defined contracts.
. Avoid circular dependencies, shared mutable state, and unnecessary cross-module dependencies.
. Keep business logic separate from controllers, database access, and HTTP concerns.
. Use shared utilities only for genuinely reusable, framework-independent functionality.
. Follow SOLID, DRY, and separation of concerns without overengineering.

 Naming & Code Quality
. Use camelCase for variables, functions, and methods.
. Use PascalCase for classes, interfaces, types, and enums.
. Use UPPER_SNAKE_CASE for environment variables and true constants.
. Use descriptive names and consistent kebab-case file names.
. Avoid any, duplicate logic, oversized classes, magic values, and unnecessary abstractions.
. Follow NestJS conventions, TypeScript strictness, ESLint, and Prettier.

  Database & API
. Use the existing shared Prisma service/provider; never create Prisma clients per feature.
. Keep database queries in appropriate services or dedicated data-access providers.
. Validate inputs using DTOs and appropriate validation decorators.
. Use transactions for operations requiring atomicity.
. Handle errors, authorization, and database constraints appropriately.
. Use version-controlled Prisma migrations for schema changes.
. Preserve existing API contracts unless changes are required.

  Mandatory Workflow

1. Inspect existing code, dependencies, and related modules before implementing a feature.
2. Create a dedicated feature folder and separate files by responsibility.
3. Prefer dependency inversion and explicit contracts so features can evolve independently.
4. Avoid modifying unrelated code or introducing unnecessary dependencies.
5. Add relevant tests and update documentation when needed.
6. Run available tests, linting, and type checks; report any checks that could not be run.
7. Summarize files changed, architectural decisions, migrations, and verification results.


Priority: Design every feature for future enhancement and replacement with minimal impact on other modules. Prefer simple, loosely coupled solutions over tightly integrated implementations.