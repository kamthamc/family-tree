# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [1.5.1] - 2026-01-03
### Fixed
- Fixed the docker image tagging in github actions

## [1.4.0] - 2026-01-03
### Added
- Added Lineage support
- Updated Export CSV quality
- Added optional address and ph number support

## [1.3.0] - 2025-12-09
### Added
- **Session**: Extended authentication session duration to 12 hours (was 15m).
- **UX**: Replaced jarring browser alerts with sleek Toast notifications for success/error messages.
- **Export**: Improved PNG export quality, ensuring text is sharp even when zoomed out.
- **Delete**: Implemented "Delete Family Tree" feature with confirmation.

### Changed
- **Cleanup**: Renamed `NewFamilyTree` component to `FamilyTree` and removed legacy files.
- **Cleanup**: Standardized internal file naming conventions.

## [1.2.0] - 2025-12-08
### Added
- **Docker**: Enabled version tagging for Docker images (e.g., `familytree:1.2.0`).

### Fixed
- **Database**: Fixed startup crash by forcing usage of `DATABASE_URL`.
- **Frontend**: Fixed production crash `TypeError: Cannot set properties of undefined` by simplifying build chunks.
- **Deployment**: Removed conflicting ACR Cache Rule and duplicate `deploy-india.sh`.
- **Stability**: Switched SQLite journal mode to `DELETE` for better reliability on Azure Files.

## [1.1.1] - 2025-12-08
### Added
- **Changelog**: Added this "What's New" display in the application.
- **Versioning**: Added Client and Server version display in the sidebar.
- **Deployment**: Added generic `deploy.sh` script for multi-region support.
- **Health Check**: Added `/health` endpoint for Azure monitoring.
- **Caching**: Improved performance with long-term caching for static assets.

### Fixed
- **Database**: Fixed startup issues by running migrations automatically.
- **API**: Fixed hardcoded API URLs to work in production environments.

## [1.0.1] - 2025-12-08
### Added
- Initial generic deployment scripts.

### Fixed
- Minor bug with version bumping script.

## [1.0.0] - 2025-12-08
### Added
- Initial Release.
- Family Tree visualization.
- Multi-user support with Authentication.
- Azure Bicep infrastructure.
