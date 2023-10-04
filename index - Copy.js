/**
 * Import function triggers from their respective submodules:
 *
 * const {onCall} = require("firebase-functions/v2/https");
 * const {onDocumentWritten} = require("firebase-functions/v2/firestore");
 *
 * See a full list of supported triggers at https://firebase.google.com/docs/functions
 */

// The Cloud Functions for Firebase SDK to create Cloud Functions and Triggers

const { initializeApp } = require("firebase-admin/app");
const { getFirestore } = require("firebase-admin/firestore");
const serviceAccount = require("./ServiceAccountKey.json");
const admin = require("firebase-admin");
const latex = require("latex");
const fs = require("fs");
const functions = require("firebase-functions");

admin.initializeApp({
  credential: admin.credential.cert(serviceAccount)
});

// get database object
const db = getFirestore();

/*
// get data
db.collection("coleTest").get().then((snapshot) => {
  snapshot.docs.forEach((doc) => {
      console.log(doc.id, '=>', doc.data());
  });
}).catch((err) => {
  console.log("Error getting documents", err);
});
*/

// const ostmpdir = require("os-tmpdir");
// console.log(ostmpdir());

exports.generatePdf = functions.firestore.document('coleTest/{docId}')
    .onCreate(async (snap, context) => {
        const data = snap.data();

        // Use LaTeX.js to generate the PDF
        const docDefinition = `
            \\documentclass{article}
            \\begin{document}
            Hello, world!
            \\end{document}
        `;

        console.log("Document data:", data);
        const pdfDoc = latex(docDefinition);

        // Convert the PDF to a string and then to a buffer
        const pdfString = await new Promise((resolve, reject) => {
            const chunks = [];
            pdfDoc.getStream().on('data', (chunk) => chunks.push(chunk));
            pdfDoc.getStream().on('end', () => resolve(Buffer.concat(chunks)));
            pdfDoc.getStream().on('error', reject);
            pdfDoc.end();
        });

        // Upload the PDF to Firebase Storage
        const bucket = admin.storage().bucket("pdf-json-buckets");
        const file = bucket.file(`pdfs/${context.params.docId}.pdf`);
        await file.save(pdfString, {
            contentType: 'application/pdf',
            metadata: {
                contentType: 'application/pdf'
            }
        });

        console.log(`PDF saved to ${file.name}`);
    });





exports.makeUppercase = functions.firestore.document("/messages/{documentId}")
    .onCreate((snap, context) => {
      const original = snap.data().original;
      console.log("Uppercasing", context.params.documentId, original);
      const uppercase = original.toUpperCase();
      return snap.ref.set({uppercase}, {merge: true});
    });


