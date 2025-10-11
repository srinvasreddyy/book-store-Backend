# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

---

## [Unreleased]


### `feature-FEATURE-018`

-   **feat(admin):** Overhauled the discount system to support Percentage, Flat Amount, and Free Delivery coupons.
-   **feat(admin):** Added robust validation rules to coupons, including minimum cart value, total usage limits, and per-user limits.
-   **feat(admin):** Implemented ownership for coupons, allowing admins to manage only the discounts they create.
-   **refactor(order):** Rewrote the checkout logic to handle complex discount validation and application in a transaction-safe manner.
-   **refactor(model):** Significantly updated the `Discount` and `Order` models to support the new pricing rules.


### `feature-FEATURE-017`

-   **feat(admin):** Implemented a system for admins to create and manage their own book categories.
-   **feat(admin):** Created endpoints for admins to list their categories and see the books published under each one.
-   **refactor(model):** Major schema change for `Book` and `Category` models to support a unified, reference-based category system.
-   **refactor(book):** Updated book creation and retrieval logic to handle the new category system and populate category data.

### `feature-FEATURE-016`

-   **feat(homepage):** Implemented a new system for admins to create and manage a personal homepage.
-   **feat(homepage):** Added support for three content types: carousel images, YouTube videos, and uploaded short videos.
-   **feat(homepage):** Created new models, controllers, and routes to handle all homepage functionality.
-   **feat(homepage):** Implemented a public endpoint to view admin homepages by username.
-   **feat(upload):** Added server-side validation to ensure uploaded short videos are under 3 minutes.


### `feature-FEATURE-015`

-   **feat(admin):** Added `uploadedBy` to the `orderedItemSchema` to track book ownership in sales.
-   **feat(admin):** Implemented a new dashboard endpoint for admins to view their personal sales revenue and units sold.
-   **refactor(order):** Updated the checkout process to correctly attribute sold items to the admin who uploaded them.


### `feature-FEATURE-014`

-   **feat(admin):** Added `uploadedBy` field to the Book model to track ownership.
-   **feat(admin):** Implemented a new endpoint for admins to view only their own uploaded books.
-   **feat(admin):** Created a new dashboard endpoint to provide book-related statistics for the logged-in admin.
-   **security(admin):** Enforced ownership checks on book update and delete operations, preventing admins from modifying each other's data.


### `feature-FEATURE-013`

-   **feat(admin):** Expanded the Book model with detailed fields including ISBN, publisher, pages, format, language, and descriptions.
-   **feat(admin):** Implemented a standalone Tag model and linked it to books.
-   **feat(admin):** Added robust validation for all new book fields in the controller.
-   **refactor(user):** Simplified the User model's `role` enum to only 'CUSTOMER' and 'ADMIN'.

### `feature-FEATURE-012`

-   **feat(security):** Integrated `helmet` to set secure HTTP headers.
-   **feat(security):** Added global API rate limiting to prevent abuse.
-   **feat(core):** Implemented a global error handling middleware for consistent error responses.

**Files Changed:**
- ├── package.json
- └── src/
-   └── app.js

---

### `feature-FEATURE-011`

-   **feat(dashboard):** Added admin-only endpoint to fetch key application statistics.
-   **feat(dashboard):** Added admin-only endpoint to fetch recent orders.

**Files Changed:**
- └── src/
-   ├── app.js
-   └── api/
-       ├── controllers/
-       │   └── dashboard.controller.js
-       └── routes/
-           └── dashboard.routes.js

---

### `feature-FEATURE-010`

-   **feat(cart):** Implemented endpoints for users to manage their shopping cart.
-   **feat(order):** Added a checkout endpoint to simulate order creation.
-   **feat(order):** Integrated discount validation into the checkout process.
-   **feat(cart):** Added Cart model.
-   **feat(order):** Added Order model.

**Files Changed:**
- └── src/
-   ├── app.js
-   └── api/
-       ├── controllers/
-       │   ├── cart.controller.js
-       │   └── order.controller.js
-       ├── models/
-       │   ├── cart.model.js
-       │   └── order.model.js
-       └── routes/
-           ├── cart.routes.js
-           └── order.routes.js

---

### `feature-FEATURE-009`

-   **feat(discount):** Added Admin-only CRUD endpoints for managing discounts.
-   **feat(discount):** Implemented support for percentage, fixed-amount, and category-specific discounts.
-   **feat(discount):** Added a public endpoint to validate coupon codes for checkout.
-   **feat(discount):** Added Discount model.

**Files Changed:**
- └── src/
-   ├── app.js
-   └── api/
-       ├── controllers/
-       │   └── discount.controller.js
-       ├── models/
-       │   └── discount.model.js
-       └── routes/
-           └── discount.routes.js

---

### `feature-FEATURE-008`

-   **feat(announcement):** Added Admin-only CRUD endpoints for announcements.
-   **feat(announcement):** Implemented schedule-based visibility with `startDate` and `endDate`.
-   **feat(announcement):** Added a public endpoint to fetch only active and current announcements.
-   **feat(announcement):** Added Announcement model.

**Files Changed:**
- └── src/
-   ├── app.js
-   └── api/
-       ├── controllers/
-       │   └── announcement.controller.js
-       ├── models/
-       │   └── announcement.model.js
-       └── routes/
-           └── announcement.routes.js

---

### `feature-FEATURE-007`

-   **feat(video):** Added Admin-only CRUD endpoints for managing videos.
-   **feat(video):** Linked videos to books and added a public endpoint to fetch videos by book.
-   **feat(upload):** Reused Multer and Cloudinary utilities for video file uploads.
-   **feat(video):** Added Video model.

**Files Changed:**
- └── src/
-   ├── app.js
-   └── api/
-       ├── controllers/
-       │   └── video.controller.js
-       ├── models/
-       │   └── video.model.js
-       └── routes/
-           └── video.routes.js

---

### `feature-FEATURE-006`

-   **feat(book):** Enhanced `GET /api/v1/books` with filtering by category.
-   **feat(book):** Added text search functionality for title and author fields.
-   **feat(book):** Implemented sorting by fields like price.
-   **chore(db):** Added text index to Book model for efficient searching.

**Files Changed:**
- └── src/
-   └── api/
-       ├── controllers/
-       │   └── book.controller.js
-       └── models/
-           └── book.model.js

---

### `feature-FEATURE-005`

-   **feat(book):** Added Admin-only CRUD endpoints for managing books.
-   **feat(upload):** Integrated Multer and Cloudinary for cover image uploads.
-   **feat(book):** Added public endpoints to list books and view a single book by ID.
-   **feat(book):** Added Book model with reference to categories.

**Files Changed:**
- └── src/
-   ├── app.js
-   ├── utils/
-   │   └── cloudinary.js
-   └── api/
-       ├── controllers/
-       │   └── book.controller.js
-       ├── middlewares/
-       │   └── multer.middleware.js
-       ├── models/
-       │   └── book.model.js
-       └── routes/
-           └── book.routes.js

---

### `feature-FEATURE-004`

-   **feat(category):** Added Admin-only CRUD endpoints for managing categories and subcategories.
-   **feat(category):** Added public endpoint to list all categories.
-   **feat(auth):** Implemented `verifyAdmin` middleware for role-based access control.
-   **feat(category):** Added Category model with support for nested structures.

**Files Changed:**
- └── src/
-   ├── app.js
-   └── api/
-       ├── controllers/
-       │   └── category.controller.js
-       ├── middlewares/
-       │   └── rbac.middleware.js
-       ├── models/
-       │   └── category.model.js
-       └── routes/
-           └── category.routes.js

---

### `feature-FEATURE-003`

-   **feat(user):** Added endpoints for fetching current user, updating account details, and changing password.
-   **feat(security):** All profile management routes are now protected by JWT authentication.

**Files Changed:**
- └── src/
-   └── api/
-       ├── controllers/
-       │   └── user.controller.js
-       └── routes/
-           └── user.routes.js

---

### `feature-FEATURE-002`

-   **feat(auth):** Added user registration, login, and logout functionality.
-   **feat(auth):** Implemented JWT-based authentication with access and refresh tokens.
-   **feat(auth):** Created `verifyJWT` middleware to protect routes.
-   **feat(user):** Added User model with password hashing and token generation methods.

**Files Changed:**
- └── src/
-   ├── app.js
-   └── api/
-       ├── controllers/
-       │   └── user.controller.js
-       ├── middlewares/
-       │   └── auth.middleware.js
-       ├── models/
-       │   └── user.model.js
-       └── routes/
-           └── user.routes.js

---

### `feature-FEATURE-001`

-   **feat(core):** Initialized project with Express server, MongoDB connection, and core utilities.
-   **feat(healthcheck):** Added a `GET /api/v1/healthcheck` endpoint for monitoring.

**Files Changed:**
- ├── package.json
- ├── index.js
- └── src/
-   ├── app.js
-   ├── constants.js
-   ├── db/
-   │   └── index.js
-   ├── utils/
-   │   ├── ApiError.js
-   │   ├── ApiResponse.js
-   │   └── asyncHandler.js
-   └── api/
-       ├── controllers/
-       │   └── healthcheck.controller.js
-       └── routes/
-           └── healthcheck.routes.js