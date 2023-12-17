Google Cloud Functions program: index.js
Google Cloud Run (Docker) program: demo5.js, .env, .eslintrc, .gitignore, ServiceAccountKey.json
- rename: "temp.env" -> ".env", "temp.eslintrc" -> ".eslintrc", "temp.gitignore" -> ".gitignore"
- index.js is not related to the Docker image: packaging it may override normal execution
- SendGrid account not included: API key found in .env file
- Email account ownership (for use with SendGrid) not included: deleted after class project deadline
