# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Development Commands

### Core Commands
- `npm run dev` - Start development server with Turbopack
- `npm run build` - Build production application
- `npm run start` - Start production server
- `npm run lint` - Run ESLint checks
- `npm run test` - Run Jest test suite

### Testing
- Use Jest for all tests with Node.js environment
- Tests are located in `/tests` directory
- Run single test: `npm run test -- path/to/test.test.ts`
- Test timeout is 15 seconds with max 1 worker for stability

## Architecture Overview

This is a Next.js 15 application for "Telas y tejidos luciana" (fabric and textile management) with the following key components:

### Tech Stack
- **Framework**: Next.js 15 with App Router
- **Database**: MongoDB with Prisma ORM
- **Authentication**: NextAuth.js v5 with JWT tokens (1-day TTL)
- **Caching**: Redis (Upstash) for both rate limiting and data caching
- **Storage**: AWS S3 for file management
- **UI**: Tailwind CSS + shadcn/ui components + Material-UI
- **Email**: Resend for transactional emails

### Key Architecture Patterns

#### Authentication & Authorization
- Uses NextAuth.js with credentials provider and bcrypt password hashing
- Role-based access control with roles: `seller`, `admin`, `major_admin`
- JWT tokens have 1-day TTL with password history tracking
- Complex middleware handles public routes, API protection, and admin access

#### Data Management
- **Inventory System**: S3-based JSON storage with Redis caching (7-day TTL)
- **Packing List Processing**: Excel file upload and processing for fabric rolls
- **Sales & Returns**: Roll-based inventory tracking system
- **User Management**: Admin-only user creation and verification

#### Caching Strategy
- Redis with separate instances for rate limiting and data caching
- Cache keys follow pattern: `cache:prefix:sorted_params`
- TTL values: inventory (7 days), user data (1 day), other data (7 days)

#### File Management
- S3 buckets for different data types (inventario, fichas-tecnicas, clientes)
- Presigned URLs for secure file downloads
- JSON and CSV export capabilities

### Directory Structure
- `/src/app/(auth)` - Authentication pages (login, forgot password, reset)
- `/src/app/(home)` - Public pages (catalog, privacy policy)
- `/src/app/(protected)` - Dashboard and protected routes
- `/src/app/api` - API routes with comprehensive endpoint coverage
- `/src/components` - Reusable UI components organized by feature
- `/src/lib` - Utility functions (database, S3, Redis, email, caching)
- `/src/hooks` - Custom React hooks
- `/types` - TypeScript type definitions
- `/tests` - Jest test files mirroring API structure

### API Endpoints Structure
- **Authentication**: `/api/auth/*` - Login, password reset, session management
- **Inventory**: `/api/s3/inventario/*` - CRUD operations for inventory data
- **Packing Lists**: `/api/packing-list/*` - File upload and roll processing
- **Sales & Returns**: `/api/sales/*`, `/api/returns/*` - Roll tracking
- **File Management**: `/api/s3/fichas-tecnicas/*`, `/api/s3/clientes/*`
- **CRON Jobs**: `/api/cron/*` - Scheduled tasks with bearer token auth

### Security Features
- Rate limiting on sensitive endpoints (auth, contact, file uploads)
- Direct browser access prevention for API routes
- Internal system request validation with bearer tokens
- Role-based middleware protection
- CRON endpoint protection with secret tokens

### Business Domain
This application manages a textile/fabric business with:
- Fabric inventory tracking with costs and quantities
- Roll-based inventory system from packing lists
- Sales and returns processing
- Client and technical specification (fichas técnicas) management
- Weekly inventory reporting via CRON jobs
- Multi-role user system for different access levels

## Design Patterns & Clean Code Strategy

### Strategic Design Thinking
Always think strategically about which design patterns best serve clean, scalable code. Consider these key principles when making architectural decisions:

#### SOLID Principles Application
- **Single Responsibility Principle (SRP)**: Each component, hook, or utility should have one clear purpose
- **Open/Closed Principle (OCP)**: Code should be open for extension, closed for modification
- **Liskov Substitution Principle (LSP)**: Derived classes must be substitutable for base classes
- **Interface Segregation Principle (ISP)**: Clients shouldn't depend on interfaces they don't use
- **Dependency Inversion Principle (DIP)**: Depend on abstractions, not concretions

#### Recommended Design Patterns for This Codebase
1. **Repository Pattern**: Already implemented for data access (S3, Redis, Database)
2. **Factory Pattern**: For creating different types of processors (inventory, packing lists)
3. **Strategy Pattern**: For different authentication strategies and file processing approaches
4. **Observer Pattern**: For event-driven inventory updates and notifications
5. **Decorator Pattern**: For adding functionality to existing components without modification
6. **Adapter Pattern**: For integrating with external services (S3, Redis, email providers)

#### Clean Architecture Layers
Follow these architectural boundaries:
- **Entities Layer**: Business models and domain logic (`/types`, core business rules)
- **Use Cases Layer**: Application-specific business rules (`/src/actions`, `/src/hooks`)
- **Interface Adapters Layer**: Controllers and presenters (`/src/app/api`, `/src/components`)
- **Infrastructure Layer**: External interfaces (`/src/lib` - database, S3, Redis, email)

#### Code Quality Guidelines
- **Low Coupling**: Minimize dependencies between modules
- **High Cohesion**: Ensure components have a single, well-defined purpose
- **Modularity**: Design for easy isolation of changes and features
- **Testability**: Write code that can be easily unit tested (already achieved with 100% API test coverage)
- **Separation of Concerns**: Keep business logic separate from infrastructure and presentation

#### TypeScript Best Practices
- Use strict type checking and leverage TypeScript's advanced features
- Implement proper interfaces for external dependencies
- Use generics for reusable components and utilities
- Leverage discriminated unions for type safety in complex data structures

#### Next.js Architectural Considerations
- **Server Components**: Use for data fetching and heavy computations
- **Client Components**: Only when interactivity is needed
- **API Routes**: Keep thin, delegate business logic to service layers
- **Middleware**: Use for cross-cutting concerns (auth, logging, rate limiting)
- **Custom Hooks**: Encapsulate complex state management and side effects

### Pattern Selection Strategy
When implementing new features, consider:
1. **Scalability**: Will this pattern support growth?
2. **Maintainability**: How easy is it to modify and extend?
3. **Performance**: Does it introduce unnecessary overhead?
4. **Team Knowledge**: Can the team understand and maintain it?
5. **Business Requirements**: Does it align with domain needs?

## Important Notes
- All API routes have comprehensive test coverage
- Redis caching is critical for performance - always use cache keys properly
- File uploads are handled through S3 with proper error handling
- Authentication middleware is complex - review `/src/middleware.ts` for route protection logic
- The system uses Spanish language throughout the UI and error messages