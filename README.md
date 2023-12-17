Google Cloud Functions program: index.js
- local deployment to Google project / Firestore requires local project dependencies be built: https://cloud.google.com/functions/docs/deploy

Google Cloud Run (Docker) program: demo5.js, .env, .eslintrc, .gitignore, ServiceAccountKey.json
- NPM dependencies not included, reference program "require" lines at top of demo5.js
- rename: "temp.env" -> ".env", "temp.eslintrc" -> ".eslintrc", "temp.gitignore" -> ".gitignore"
- index.js is not related to the Docker image: packaging it may override normal execution
- SendGrid account not included: API key found in .env file
- Email account ownership (for use with SendGrid) not included: deleted after class project deadline
