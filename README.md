# Translate API (`be_translate`)

An intelligent multi-language backend translation system (RESTful API), integrating Large Language Models (LLMs via Ollama), Vector Database (Qdrant) for **RAG (Retrieval-Augmented Generation)**, automated input typo correction (**Mistype Correction**), semantic caching (**Semantic Cache**), and an administrative domain terminology management system.

---


## 📑 Table of Contents

10. [Key Features](#-key-features)
11. [Tech Stack](#-tech-stack)
12. [Directory Structure](#-directory-structure)
13. [Installation & Quick Start](#-installation--quick-start)
14. [Environment Variables (.env)](#-environment-variables-env)
15. [API Documentation (Swagger UI)](#-api-documentation-swagger-ui)
16. [Core API Endpoints](#-core-api-endpoints)
17. [Vector DB Synchronization & Fuzzy Search](#-vector-db-synchronization--fuzzy-search)
18. [License](#-license)

---


## 🚀 Key Features

- **Multi-Strategy Translation Engine:**
  - **Normal Translation:** Direct model translation without RAG overhead (`/api/translate-normal`, `/api/translate-single`).
  - **RAG Translation:** Retrieves specialized internal vocabulary by categories (`categories`) from the Qdrant Vector DB to supply accurate terminology context to the LLM.
  - **Mistype Auto-Correction:** Automatically detects and fixes spelling errors and typos before submitting text to the translation model (`/api/translate`).
  - **Beta Translation (HY-MT1.5):** Dedicated support for specialized high-accuracy translation models.
- **Semantic Caching & Feedback Loop:**
  - Automatically caches translation results and prompts based on semantic keys.
  - Collects user ratings (1-5 stars), comments, and suggested corrections (`/api/feedback`).
  - One-click admin approval (`/api/feedback/:id/approve`) to promote corrections directly into Semantic Cache (90-day TTL).
  - Real-time notifications dispatched to Synology Chat channels when new feedback arrives.
- **Vocabulary & Category Management:**
  - Manage specialized domain terms scoped by departments/categories (e.g., HR, IT, Production, PCC).
  - Batch import vocabularies via Excel / CSV files (`/api/upload-vocabulary`).
  - Automatic 768-dimensional vector embedding generation (`embeddinggemma`) and two-way synchronization to Qdrant via Sequelize lifecycle hooks.
  - Typo-tolerant and diacritic-insensitive fuzzy search (`pg_trgm`).
- **API Manager & Load Balancing:**
  - Supports multiple Ollama endpoints running concurrently.
  - Request queue management with busy status tracking, automatic failover, and model-compatibility fallback (bypassing endpoints that return 404 for missing models).
- **Security & Access Control:**
  - JWT-based authentication (Access Tokens & Refresh Tokens) with local DB and Global API verification.
  - Role-based permissions (`admin`, `user`) with category scoping.
  - Rate limiting to protect against abuse.
- **Admin Dashboard:**
  - Request volume metrics and unique active IP tracking by day or month.
  - Feedback quality monitoring and direct Semantic Cache management (view, edit, delete bad translations).

---

## 🛠 Tech Stack

- **Runtime:** Node.js (>= 20.x, ES Modules `type: "module"`)
- **Framework:** Express.js 5
- **Database & ORM:** MySQL / PostgreSQL (managed via Sequelize 6)
- **Vector Database:** Qdrant REST Client (`@qdrant/js-client-rest`)
- **AI & LLM Services:**
  - Ollama: Qwen (qwen3:8b, qwen3:14b, qwen3:32b), Gemma3 (12b), HY-MT1.5
  - Embeddings: `embeddinggemma:latest` (768-dimensional vectors)
- **API Documentation:** Swagger JSDoc + Swagger UI Express (OpenAPI 3.0)
- **Security & Utilities:** JSON Web Token (jsonwebtoken), bcryptjs, express-rate-limit, axios, xlsx, multer

---

## 📁 Directory Structure

```text
be_translate/
├── config/                     # Database, Swagger, and Vector DB configurations
│   ├── db.js                   # Sequelize connection (MySQL / Postgres)
│   ├── swagger.js              # OpenAPI / Swagger UI configuration
│   └── vectorDB.js             # Vector cache initialization
├── constants/                  # System constants and category definitions
├── controllers/                # Request handlers and business logic
│   ├── authController.js       # User registration and authentication
│   ├── cacheController.js      # Semantic Cache administration
│   ├── categoryController.js   # Vocabulary category management
│   ├── dashboardController.js  # Analytics and metrics for admins
│   ├── feedbackController.js   # Translation feedback & Synology webhook
│   ├── translateController.js  # Translation pipelines (Normal, RAG, Beta)
│   ├── urlController.js        # Ollama endpoint management
│   ├── userController.js       # User account management
│   └── vocabularyController.js # Terminology and vocabulary management
├── helpers/                    # Prompt builders, typo correction, model mapping
│   ├── buildCategoryPrompt.js
│   ├── buildPrompt.js
│   ├── correctMistype.js       # Typo correction workflow client
│   └── translationHelper.js
├── middleware/                 # Express middleware
│   ├── authMiddleware.js       # JWT authentication & authorization
│   ├── rateLimitMiddleware.js  # Request rate limiting
│   └── requestLoggerMiddleware.js # Access logging & client IP extraction
├── models/                     # Sequelize models & lifecycle hooks
│   ├── Category.js
│   ├── RequestLog.js
│   ├── SemanticCache.js
│   ├── Translation.js
│   ├── TranslationFeedback.js
│   ├── Url.js
│   ├── User.js
│   ├── Vocabulary.js
│   └── VocabularyTranslation.js # Auto-syncs embeddings to Qdrant
├── routes/                     # API routes and Swagger doc bindings
│   ├── apiRoute.js             # Dynamic endpoint routing
│   ├── authRoutes.js           # Authentication routes
│   ├── categoryRoutes.js       # Category routes
│   ├── dashboardRoutes.js      # Dashboard routes
│   ├── feedbackRoutes.js       # Feedback & cache routes
│   ├── translateRoutes.js      # Translation routes
│   ├── userRoute.js            # User management routes
│   ├── vocabularyRoutes.js     # Vocabulary routes
│   └── index.js                # Master route aggregator
├── services/                   # Low-level service layer (LLM, Qdrant, Cache)
│   ├── apiManager.js           # Ollama load balancer & request queue
│   ├── CAG/                    # Cache & Embedding generation
│   │   ├── cacheService.js
│   │   └── embedding.js
│   ├── RAG/                    # Context retrieval & Qwen execution
│   │   └── qwenService.js
│   └── translate/              # Translation execution strategies
├── utils/                      # Text normalization and utility functions
│   └── textNormalization.js    # Diacritic stripping and search normalization
├── .env.example                # Template for environment variables
├── .gitignore                  # Git ignore rules
├── index.js                    # Application entry point
└── package.json                # Project dependencies and npm scripts
```

---

## ⚙️ Installation & Quick Start

### 1. Prerequisites

- Node.js >= 20.0.0
- npm >= 9.0.0
- Relational Database: MySQL or PostgreSQL
- (Optional) Running instances of Ollama and Qdrant if using AI/RAG capabilities.

### 2. Install Dependencies

```bash
npm install
```


### 3. Environment Configuration

Create a `.env` file from the provided template:

```bash
cp .env.example .env
```

Open `.env` and fill in your database credentials, Ollama endpoints, Qdrant configurations, and JWT secrets.


### 4. Run the Server

Start the application:

```bash
npm start
```


Upon startup, the system will:

1. Connect and synchronize all database tables (`sequelize.sync({ alter: true })`).
2. Load active Ollama endpoints from the `Urls` table or environment variables into the load balancer.
3. Start the Express server on the specified port (default: `http://localhost:5600`).

---


## 🔐 Environment Variables (.env)

| Variable | Default | Description |
| :--- | :--- | :--- |
| `PORT` | `5600` | Port for the HTTP server |
| `HOST` | `0.0.0.0` | Host address to bind to |
| `SWAGGER_URL` | `http://localhost:5600` | Base URL displayed in Swagger UI |
| `DB_DIALECT` | `mysql` | Database dialect (`mysql` or `postgres`) |
| `DB_HOST` | `localhost` | Database host address |
| `DB_PORT` | `3306` | Database port |
| `DB_NAME` | `translate_db` | Database name |
| `DB_USER` | `root` | Database username |
| `DB_PASS` | - | Database password |
| `JWT_SECRET` | - | Secret key used to sign Access Tokens |
| `JWT_EXPIRE` | `7d` | Access Token expiration duration |
| `JWT_REFRESH_SECRET`| - | Secret key used to sign Refresh Tokens |
| `JWT_REFRESH_EXPIRE`| `30d`| Refresh Token expiration duration |
| `OLLAMA_MODEL` | `qwen3:8b` | Default Ollama model for translations |
| `EMBED_MODEL_NAME` | `embeddinggemma:latest` | Model used for vector embeddings |
| `EMBED_REQUEST_TIMEOUT_MS` | `30000` | Embedding API timeout in milliseconds |
| `OLLAMA_EMBED_URL` | - | Ollama embedding endpoint (e.g., `http://<host>:11437/api/embeddings`) |
| `CORRECT_MISTYPE_URL`| - | Webhook URL for the typo-correction workflow |
| `CORRECT_MISTYPE_TOKEN`| - | Bearer token for the typo-correction workflow |
| `QDRANT_URL` | - | Qdrant Vector DB server URL |
| `QDRANT_API_KEY` | - | Qdrant API key |
| `SYNO_CHANNEL_URL` | - | Synology Chat webhook URL for feedback alerts |
| `GLOBAL_API_URL` | - | (Optional) Global authentication service endpoint |

---


## 📖 API Documentation (Swagger UI)

  Interactive API documentation and playground are available via Swagger UI:
- **Access URL:** `http://<HOST>:<PORT>/api-docs` (e.g., [http://localhost:5600/api-docs](http://localhost:5600/api-docs))
- Built-in Bearer JWT Token authentication allows testing protected routes directly from the browser.

---


## 📡 Core API Endpoints


### 1. Translation Engine

- `POST /api/translate`: Corrects typos in original text, then translates.
- `POST /api/translate-normal`: Multi-language translation without RAG.
- `POST /api/translate-single`: Translates input text into a single target language.
- `POST /api/translate-rag`: RAG-enhanced translation using category-scoped vocabulary (`categories`).
- `POST /api/translate-beta`: Beta translation using the HY-MT1.5-7B model.
- `POST /api/translate-beta-rag`: Beta translation with HY-MT1.5 combining category prompts and RAG.


### 2. Vocabulary & Category Management

- `GET /api/categories`: Retrieve all terminology categories.
- `POST /api/add-category`: Create a new category.
- `PUT /api/categories/:id`: Update category details.
- `DELETE /api/categories/:id`: Remove a category.
- `GET /api/vocabularies`: Fetch vocabulary list with translations and categories.
- `POST /api/add-vocabulary`: Create vocabulary (automatically generates vector and syncs to Qdrant).
- `POST /api/upload-vocabulary`: Batch upload vocabulary entries via Excel/CSV files.
- `PUT /api/update-vocabulary/:id`: Edit vocabulary (automatically regenerates and updates Qdrant vector).
- `DELETE /api/delete-vocabulary/:id`: Delete vocabulary (automatically removes vector from Qdrant).

### 3. Feedback & Semantic Cache

- `POST /api/feedback`: Submit translation rating (1-5 stars), user correction, and comment.
- `GET /api/feedback`: Retrieve feedback list (with pagination, filters by rating and category).
- `POST /api/feedback/:id/approve`: Admin approves user correction and promotes it into Semantic Cache.
- `GET /api/cache`: Query cached translation records with pagination and search.
- `PUT /api/cache`: Directly edit or override an existing translation in the cache.
- `DELETE /api/cache`: Invalidate/delete incorrect cache entries.

### 4. Admin Dashboard & Metrics

- `GET /api/admin/dashboard-stats`: Request count and unique user metrics by day/month for charts.
- `GET /api/admin/dashboard-summary`: Summary overview (total requests, average rating, user count).
- `GET /api/admin/dashboard-translations`: Paginated log of historical translations.

### 5. Authentication & User Management

- `POST /api/auth/register`: Register an account with department category assignments.
- `POST /api/auth/login`: Authenticate and receive JWT tokens.
- `GET /api/users`: List all users (Admin only).
- `PATCH /api/users/:id/role`: Update user permissions and role.

---

## 🧠 Vector DB Synchronization & Fuzzy Search

1. **Sequelize Hooks (`models/VocabularyTranslation.js`):**
   - **Insert / Update (`afterSave`)**: Automatically triggers `embed()` to generate a 768-dimensional vector and upserts it into the `vocabulary_collection` in Qdrant.
   - **Delete (`afterDestroy`)**: Automatically removes the corresponding vector ID from Qdrant.
3. **Diacritic-Insensitive Search (`utils/textNormalization.js`):**
   - Normalizes text by stripping diacritical marks (e.g., `Sửa chữa` → `sua chua`).
   - Populates the `textSearch` column with normalized text, leveraging `pg_trgm` GIN indexes for fast, typo-tolerant search in PostgreSQL.

---

## 📄 License

ISC License
