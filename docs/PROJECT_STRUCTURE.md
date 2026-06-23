# Hybrid Reasoning System Project Structure

**Last Updated:** October 12, 2025  
**Organization:** Clean, professional directory structure

---

## 📁 Project Root

```
AGI/
├── README.md                    # Main project documentation
├── LICENSE                      # MIT License
├── package.json                 # Dependencies and scripts
├── pnpm-lock.yaml              # Lock file
├── tsconfig.json               # TypeScript configuration
├── tsconfig.test.json          # Test TypeScript configuration
├── vitest.config.ts            # Test framework configuration
├── deployed-current.html       # Production web interface
├── wrangler.toml               # Main Cloudflare Workers config
├── wrangler.*.toml             # Environment-specific configs
│
├── src/                        # Source code (TypeScript)
├── tests/                      # Test suites
├── docs/                       # Documentation (organized)
├── deploy/                     # Deployment scripts and configs
├── scripts/                    # Utility scripts
├── c-core/                     # C implementation
├── rust-core/                  # Rust implementation
├── build/                      # Build outputs
└── dist/                       # Distribution files
```

---

## 📚 Documentation Structure

### `/docs/`

```
docs/
├── README.md                           # Documentation index
├── AGI_QUICK_START.md                 # Quick start guide
├── styles.css                         # Documentation styles
│
├── api/                               # API Documentation
│   └── README.md
│
├── architecture/                      # System Architecture
│   ├── README.md
│   ├── PRIMARY_WORKER_DESIGN.md
│   ├── MULTI_LANGUAGE_AGI_ARCHITECTURE.md
│   └── MULTI_LANGUAGE_AGI_IMPLEMENTATION_SUMMARY.md
│
├── deployment/                        # Deployment Guides
│   ├── CLOUD_DEPLOYMENT_GUIDE.md
│   ├── CLOUD_DEPLOYMENT_README.md
│   ├── CLOUD_DEPLOYMENT_SUMMARY.md
│   ├── CLOUDFLARE_DOMAIN_SETUP.md
│   └── CLOUDFLARE_WORKER_DEPLOYMENT.md
│
├── development/                       # Development Workflows
│   └── GITHUB_ACTIONS.md
│
├── executive/                         # Executive Reports
│   └── CEO_CHANGELOG_EMAIL.md
│
├── backups/                          # Historical Backups
│   ├── AGI_DESIGN_BACKUP.md
│   ├── AGI_RESPONSES_BACKUP.md
│   ├── AGI_SOURCE_BACKUP_v4.0.0.ts
│   └── deployed-current-backup-20251011.html
│
├── consciousness/                     # Consciousness System Docs
│   └── README.md
│
└── learning/                         # Learning System Docs
    └── README.md
```

---

## 💻 Source Code Structure

### `/src/`

```
src/
├── core/                             # Core AGI Systems
│   ├── RealNeuralNetwork.ts
│   ├── RealLearningEngine.ts
│   ├── RealLLMIntegration.ts
│   ├── RealReasoningEngine.ts
│   ├── ChainOfThoughtReasoning.ts
│   ├── MultiAgentSystem.ts
│   ├── ToolSystem.ts
│   ├── MemorySystem.ts
│   ├── SelfImprovementLoop.ts
│   ├── EnhancedNeuralNetwork.ts
│   ├── UltimateAGIOrchestrator.ts
│   └── [47 total files]
│
├── agents/                           # Specialized Agents
│   └── [5 agent files]
│
├── api/                              # API Layer
│   └── [1 file]
│
├── config/                           # Configuration
│   └── [1 file]
│
├── demo/                             # Demonstrations
│   └── [4 files]
│
├── models/                           # Data Models
│   └── [1 file]
│
├── services/                         # Services
│   └── [1 file]
│
├── types/                            # TypeScript Types
│   └── [2 files]
│
├── utils/                            # Utilities
│   └── [1 file]
│
├── primary-agi-worker.ts            # Main Worker (Production)
├── multi-language-agi-worker.ts     # Multi-language Worker
├── index.ts                         # Main Entry Point
├── api-server.ts                    # API Server
└── [Additional workers and systems]
```

---

## 🧪 Test Structure

### `/tests/`

```
tests/
├── setup.ts                         # Test setup
│
├── unit/                            # Unit Tests
│   ├── AGISystem.test.ts
│   ├── AGISystemComprehensive.test.ts
│   ├── BasicComponents.test.ts
│   ├── SystemMonitor.test.ts
│   └── TrueAGITest.ts
│
├── integration/                     # Integration Tests
│   └── AGIIntegration.test.ts
│
└── e2e/                            # End-to-End Tests
    └── AGIEndToEnd.test.ts
```

---

## 🚀 Deployment Structure

### `/deploy/`

```
deploy/
├── docker-compose.yml               # Docker Compose
├── Dockerfile                       # Main Dockerfile
├── Dockerfile.real-agi             # Hybrid Reasoning System Dockerfile
├── Dockerfile.simple               # Simple Dockerfile
├── Dockerfile.sentient.ts          # Sentient Dockerfile
│
├── nginx.conf                       # NGINX Configuration
├── [Various nginx configs]
│
├── deploy-*.sh                      # Deployment Scripts
├── setup-ssl.sh                    # SSL Setup
├── production-setup.sh             # Production Setup
│
├── *.yml                           # Docker Compose variants
├── cloud-deployment.js             # Cloud Deployment
├── sentient-deployment.js          # Sentient Deployment
│
└── DEPLOY_REAL_AGI.md             # Deployment Guide
```

---

## 🛠 Scripts Structure

### `/scripts/`

```
scripts/
├── build-multi-language.sh          # Multi-language Build
├── fix-imports.js                   # Import Fixer
├── test-runner.ts                   # Test Runner
└── run-agi.sh                      # AGI Runner
```

---

## 🔧 Native Implementations

### C Core (`/c-core/`)

```
c-core/
├── CMakeLists.txt                   # CMake Configuration
├── AGICCoreConfig.cmake.in         # CMake Template
│
├── include/
│   └── agi_core.h                  # C API Headers
│
└── src/
    ├── activation_functions.c
    ├── matrix_operations.c
    ├── memory_management.c
    ├── neural_operations.c
    ├── optimization.c
    └── simd_operations.c
```

### Rust Core (`/rust-core/`)

```
rust-core/
├── Cargo.toml                       # Rust Configuration
├── Cargo.lock                       # Rust Lock File
│
└── src/
    ├── lib.rs                       # Main Library
    ├── ffi.rs                       # FFI Bindings
    ├── wasm.rs                      # WASM Bindings
    ├── neural_engine.rs             # Neural Engine
    ├── consciousness.rs             # Consciousness
    └── memory_manager.rs            # Memory Manager
```

---

## 📊 Organization Benefits

### Before Organization
- 14+ markdown files in root
- Backup files mixed with production
- Deployment docs scattered
- No clear documentation hierarchy

### After Organization
- **Clean Root**: Only essential files (README, configs, interface)
- **Categorized Docs**: Clear hierarchy (architecture, deployment, development)
- **Backup Isolation**: Old files in dedicated backups/ folder
- **Professional Structure**: Easy navigation for team members
- **Executive Access**: Dedicated folder for business reports

---

## 🎯 File Location Quick Reference

### Need to find something?

| Type | Location |
|------|----------|
| **Main README** | `/README.md` |
| **Quick Start** | `/docs/AGI_QUICK_START.md` |
| **Architecture** | `/docs/architecture/` |
| **Deployment** | `/docs/deployment/` |
| **CEO Report** | `/docs/executive/CEO_CHANGELOG_EMAIL.md` |
| **API Docs** | `/docs/api/README.md` |
| **Source Code** | `/src/` |
| **Tests** | `/tests/` |
| **Deployment Scripts** | `/deploy/` |
| **Utility Scripts** | `/scripts/` |
| **Backups** | `/docs/backups/` |
| **Web Interface** | `/deployed-current.html` |
| **Main Worker** | `/src/primary-agi-worker.ts` |

---

## 🔍 Key Files

### Configuration
- `package.json` - Dependencies and scripts
- `tsconfig.json` - TypeScript configuration
- `vitest.config.ts` - Test configuration
- `wrangler.toml` - Cloudflare Workers config

### Production
- `src/primary-agi-worker.ts` - Production worker
- `deployed-current.html` - Web interface
- `src/core/UltimateAGIOrchestrator.ts` - Main orchestrator

### Documentation
- `README.md` - Main documentation
- `docs/AGI_QUICK_START.md` - Quick start
- `docs/executive/CEO_CHANGELOG_EMAIL.md` - Executive summary

---

## 📝 Naming Conventions

### Files
- **UPPERCASE.md**: Major documentation (e.g., `README.md`, `LICENSE`)
- **PascalCase.ts**: TypeScript classes/modules
- **kebab-case.sh**: Shell scripts
- **kebab-case.yml**: Configuration files

### Directories
- **lowercase**: Standard directories (`src`, `docs`, `tests`)
- **kebab-case**: Multi-word directories (`c-core`, `rust-core`)

---

## 🚦 Status

✅ **Organized:** October 12, 2025  
✅ **Tests Passing:** 181 tests  
✅ **Type-Safe:** Zero TypeScript errors  
✅ **Deployed:** https://agi.bleujs.org  
✅ **Clean Structure:** Professional organization  

---

**Maintained by:** Development Team  
**Contact:** [your-email]  
**Repository:** https://github.com/HelloblueAI/bleujs-reasoning-lab

