# 🌳 Family Tree App

A secure, multi-user family tree application built with modern web technologies.

![Family Tree](https://images.unsplash.com/photo-1549241520-425e3dfc01cb?q=80&w=2787&auto=format&fit=crop)

## 🚀 Features

- **Multi-Tenancy**: Support for multiple users and multiple family trees per user.
- **Secure Encryption**: Per-user AES-256-GCM encryption ensures your data is private, even from database administrators.
- **Interactive Visualization**: Dynamic family tree graph with React Flow.
- **Rich Metadata**: Track detailed information about family members, events, and relationships.
- **Modern UI**: Beautiful, responsive interface built with React and Tailwind CSS.
- **Share & Collaborate**: (Coming Soon) Share family trees with granular permissions.

## 🛠 Tech Stack

**Frontend:**
- React 18, Vite
- TypeScript, Tailwind CSS
- React Flow, Lucide Icons
- React Query, Zustand

**Backend:**
- Bun (Runtime & Server)
- Hono (Web Framework)
- SQLite (Database)
- Drizzle ORM
- JSON Web Tokens (JWT)

**Infrastructure:**
- Docker
- Azure App Service
- Azure Key Vault
- Azure Files

## 🏁 Getting Started

### Prerequisites
- [Bun](https://bun.sh) installed
- Node.js 18+ (optional, for some tools)

### Installation

1. **Clone the repository**
   ```bash
   git clone https://github.com/yourusername/family-tree.git
   cd family-tree
   ```

2. **Install dependencies**
   ```bash
   # Server
   cd server
   bun install
   
   # Client
   cd ../client
   bun install
   ```

3. **Environment Setup**
   ```bash
   cd server
   cp .env.example .env
   # Generate encryption key
   bun run generate-key.sh
   # Update .env with the generated key and your settings
   ```

4. **Database Setup**
   ```bash
   cd server
   bun run apply-migration.ts
   ```

5. **Run Locally**
   ```bash
   # Terminal 1: Server
   cd server
   bun run dev
   
   # Terminal 2: Client
   cd client
   bun run dev
   ```

## 🔒 Security

This application uses a detailed security model:
- **Zero-Knowledge Architecture Goal**: Server stores encrypted user keys. access requires user password.
- **Encryption**: Data is encrypted at rest using AES-256-GCM.
- **Authentication**: Custom JWT implementation with secure HTTP-only cookies (planned) / headers.

See [SECURITY.md](docs/SECURITY.md) for more details.

## 📘 Documentation

- [Architecture Overview](docs/ARCHITECTURE.md)
- [Security Model](docs/SECURITY.md)
- [Deployment Guide](docs/DEPLOYMENT.md)
- [Remote Debugging](docs/REMOTE_DEBUGGING.md)

## 📄 License

MIT
