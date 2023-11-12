const admin = require('firebase-admin');
const fs = require('fs');
const Handlebars = require('handlebars');

// Initialize Firebase Admin SDK
const serviceAccount = require('./ServiceAccountKey.json');
admin.initializeApp({
    credential: admin.credential.cert(serviceAccount)
});
const db = admin.firestore();

// Read LaTeX template
const templateSource = fs.readFileSync('handlebarExample.tex', 'utf8');
const latexTemplate = Handlebars.compile(templateSource);

async function compileLatexTemplate() {
    try {
        // get data from Firestore 
        const docRef = db.collection('InvoiceTest').doc('one');
        const docSnapshot = await docRef.get();

        if (docSnapshot.exists) {
            const data = docSnapshot.data();

            // Log the data to check what's being received
            console.log('Received data:', data);

            // Compile LaTeX template with Firestore data
            const latexDocument = latexTemplate(data);

            // save LaTeX output
            fs.writeFileSync('handlebarOutput.tex', latexDocument);

            console.log('Latex document generated successfully.');
        } else {
            console.error('Document does not exist.');
        }
    } catch (error) {
        console.error('Error:', error);
    }
}

compileLatexTemplate();
