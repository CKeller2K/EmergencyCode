Deployment Brief:

1. Google Cloud Project
   - Implied to exist by functional requirements
   - Same project should have Google Firebase and Google Storage support initialized
     
2. SendGrid Account
   - SendGrid account, associated (sending) email address, and resulting API key not included
   - Related API key and email address from .env file will not be maintained
   - Related link: https://app.sendgrid.com/

3. Google Cloud Run + Docker
   - Refer to DockerDocumentation.docx for compilation + deployment
   - Required for program deployment:
     - RunIndex.js 
     - .env
     - ServiceAccountKey.json (access to Google Cloud Run project)
     - package.json (list of NPM packages: *NOT AUTOMATICALLY DOWNLOADED*)
   - Refer to .env file for expected program defaults:
     - Monitored Firebase Collection name
     - Google Cloud Project ID
     - SendGrid API key
     - Default sending and receiving eMail addresses
     - Default / plain-text eMail contents

4. Google Cloud Functions
   - Related links:
     - https://cloud.google.com/functions/docs/deploy
     - https://cloud.google.com/functions/docs/calling/realtime-database
     - https://firebase.google.com/docs/functions/firestore-events?gen=1st#wildcards-parameters
   - Required for program deployment:
     - index.js
     - .env
   - Refer to .env file for expected program defaults:
     - Google Cloud Run service specific "Service URL"
     - Monitored Firebase Collection name

5. Operational Expectations
   - Refer to Handlebars_Guide.docx for LaTeX template operation and specifiers
   - Refer to "Firestore Doc Documentation.docx" for Firebase document operation
