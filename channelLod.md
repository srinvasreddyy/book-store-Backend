feature-FEATURE-001/
├── package.json
├── index.js
├── src/
│   ├── app.js
│   ├── constants.js
│   ├── db/
│   │   └── index.js
│   ├── utils/
│   │   ├── ApiError.js
│   │   ├── ApiResponse.js
│   │   └── asyncHandler.js
│   └── api/
│       ├── controllers/
│       │   └── healthcheck.controller.js
│       └── routes/
│           └── healthcheck.routes.js

- feat(core): Initialized project with Express server, MongoDB connection, and core utilities.
- feat(healthcheck): Added a GET /api/v1/healthcheck endpoint for monitoring.