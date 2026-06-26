# Security Policy

## Supported Versions

Only the latest major version is currently being supported with security updates.

| Version | Supported          |
| ------- | ------------------ |
| 1.x.x   | :white_check_mark: |
| < 1.0   | :x:                |

## Reporting a Vulnerability

If you discover a security vulnerability within this project, please send an e-mail to the repository owner or open a private security advisory on GitHub.

### API Keys and Secrets

This project does **NOT** ship with production API keys. 

Users are expected to configure their own API credentials. The repository maintainers are not responsible for user API usage, costs, or leaked keys from user deployments.

* **Never commit API keys.**
* **Never expose secrets in frontend code, git history, or public repos.**

If you accidentally leak your keys:
1. Immediately revoke the key in your provider's dashboard.
2. Generate a new key.
3. Remove the leaked secret from your git history (e.g., using `git filter-branch` or BFG Repo-Cleaner).
