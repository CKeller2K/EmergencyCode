/**
 * Import function triggers from their respective submodules:
 *
 * const {onCall} = require("firebase-functions/v2/https");
 * const {onDocumentWritten} = require("firebase-functions/v2/firestore");
 *
 * See a full list of supported triggers at https://firebase.google.com/docs/functions
 */

// The Cloud Functions for Firebase SDK to create Cloud Functions and Triggers

//npm install dotenv, firebase, latex, nodemailer, @google-cloud, maybe some more I dont remember
require("dotenv").config();
// create .env file with email credentials EMAIL= , PASSWORD= . DOTENV can hold other passwords and credentials too

const serviceAccount = require("./ServiceAccountKey.json");
const admin = require("firebase-admin");
const latex = require("latex");
const fs = require("fs");
const nodemailer = require("nodemailer");
const functions = require("firebase-functions");

admin.initializeApp({
  credential: admin.credential.cert(serviceAccount)
});

// get database object
// const db = getFirestore();

// PDF Creation Trigger
exports.createPdf = functions.firestore
  .document("coleTest/{docId}")
  .onCreate(async (snap, context) => {
    const data = snap.data();
    if (data.state === "create") {
      // Code to create PDF goes here
      const latex = data.latex; // Assuming the LaTeX document is stored in a 'latex' field

      // Compile the LaTeX document
      exec(`echo "${latex}" | pdflatex`, (error, stdout, stderr) => {
        if (error) {
          console.error("exec error: ${error}");
          return;
        }

        // Save the PDF to Firebase Storage
        const storage = require('@google-cloud/storage')();
        // Storage bucket "pdf-json-buckets"
        const bucket = storage.bucket('pdf-json-buckets');
        // PDF uses unique Document ID as its name 
        const file = bucket.file('${context.params.docId}.pdf');
        // saves object into the bucket
        file.createWriteStream()
          // informs if error has occured
          .on('error', (err) => {
            console.error(err);
          })
          // successfully saves pdf into file
          .on('finish', async () => {
            console.log('PDF saved to Firebase Storage.');

            // Update the 'state' field of the specific document to "processed"
            const docRef = admin.firestore().doc(`my-collection/${context.params.docId}`);
            await docRef.update({ state: "processed" });
          })
          // marks end of writable stream
          .end(stdout);
      });
    
      

    } 
    else if (state === "processed"){
      // code to send email
      const transporter = nodemailer.createTransport({
        service: "gmail",
        auth: {
          // uses dotenv npm to hide credentials
          user: process.env.EMAIL,
          pass: process.env.PASSWORD
        }
      });
      // reads email address if stored in a "client_email field"
      const client_email = data.client_email; 

      const mailOptions = {
        from: "csc131project@gmail.com",
        to: client_email,
        subject: "PDF Creation Completed",
        text: "The PDF creation process is complete.",
        attachments: [
          {
            filename: `${context.params.docId}.pdf`,
            path: "gs://pdf-json-buckets/${context.params.docId}.pdf",
            contentType: "application/pdf"
          }
        ]

      };
      
      // send email
      transporter.sendMail(mailOptions, (error, info) => {
        if (error) {
          console.log("Error occurred. " + error.message);
        }
        console.log("Email sent: " + info.response);
      });
      
      // updates the state to completed
      const docRef = admin.firestore().doc(`my-collection/${context.params.docId}`);
      await docRef.update({ state: "completed" });
    }
  });

  exports.updatePdf = functions.firestore
  .document("coleTest/{docId}")
  .onUpdate(async (change, context) => {
    // change.after.data() gives data of the document after the update
    const data = change.after.data();
    // change.before.data() gives data of the document before the update
    const previousData = change.before.data();
    if (data.state === "create" && previousData.state !== "create") {
      // Code to create PDF goes here
      const latex = data.latex; // Assuming the LaTeX document is stored in a 'latex' field

      // Compile the LaTeX document
      exec(`echo "${latex}" | pdflatex`, (error, stdout, stderr) => {
        if (error) {
          console.error("exec error: ${error}");
          return;
        }

        // Save the PDF to Firebase Storage
        const storage = require('@google-cloud/storage')();
        // Storage bucket "pdf-json-buckets"
        const bucket = storage.bucket('pdf-json-buckets');
        // PDF uses unique Document ID as its name 
        const file = bucket.file('${context.params.docId}.pdf');
        // saves object into the bucket
        file.createWriteStream()
          // informs if error has occured
          .on('error', (err) => {
            console.error(err);
          })
          // successfully saves pdf into file
          .on('finish', async () => {
            console.log('PDF saved to Firebase Storage.');

            // Update the 'state' field of the specific document to "processed"
            const docRef = admin.firestore().doc(`my-collection/${context.params.docId}`);
            await docRef.update({ state: "processed" });
          })
          // marks end of writable stream
          .end(stdout);
      });
    
      

    } 
    else if (state === "processed"){
      // code to send email
      const transporter = nodemailer.createTransport({
        service: "gmail",
        auth: {
          // uses dotenv npm to hide credentials
          user: process.env.EMAIL,
          pass: process.env.PASSWORD
        }
      });
      // reads email address if stored in a "client_email field"
      const client_email = data.client_email; 

      const mailOptions = {
        from: "csc131project@gmail.com",
        to: client_email,
        subject: "PDF Creation Completed",
        text: "The PDF creation process is complete.",
        attachments: [
          {
            filename: `${context.params.docId}.pdf`,
            path: "gs://pdf-json-buckets/${context.params.docId}.pdf",
            contentType: "application/pdf"
          }
        ]

      };
      
      // send email
      transporter.sendMail(mailOptions, (error, info) => {
        if (error) {
          console.log("Error occurred. " + error.message);
        }
        console.log("Email sent: " + info.response);
      });
      
      // updates the state to completed
      const docRef = admin.firestore().doc(`my-collection/${context.params.docId}`);
      await docRef.update({ state: "completed" });
    }
  });



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

// get data

// db.collection("coleTest")



/*
// upload pdf from directory
const storage = new Storage({
  keyFilename: "ServiceAccountKey.json"
});


async function uploadPdf() {
  await storage.bucket("pdf-json-buckets").upload("CSC 138 Computer Networks.pdf", {
    gzip: true,
    metadata: {
      cacheControl: 'public, max-age=31536000',
    },
  });

  console.log('PDF uploaded to Google Cloud Storage.');
}

uploadPdf().catch(console.error);
*/






/* example code from google cloud functions
exports.makeUppercase = functions.firestore.document("/messages/{documentId}")
    .onCreate((snap, context) => {
      const original = snap.data().original;
      console.log("Uppercasing", context.params.documentId, original);
      const uppercase = original.toUpperCase();
      return snap.ref.set({uppercase}, {merge: true});
    });
*/

