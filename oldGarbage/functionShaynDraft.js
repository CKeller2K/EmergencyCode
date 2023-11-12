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
// require("dotenv").config();
// create .env file with email credentials EMAIL= , PASSWORD= . DOTENV can hold other passwords and credentials too

import serviceAccount from "./ServiceAccountKey.json";
import { initializeApp, credential as _credential } from "firebase-admin";
import * as functions from 'firebase-functions';
// import * as admin from 'firebase-admin';
import latex from "latex";
import fs from "fs/promises";
// import { createTransport } from "nodemailer";
// import { config } from "firebase-functions";
import { Storage } from '@google-cloud/storage';

initializeApp({
  credential: _credential.cert(serviceAccount)
});

// const firestore = admin.firestore();

export const createPdf = functions.firestore
  .document("coleTest/{docId}")
  .onCreate(async (snap, context) => {
    const data = snap.data();
    const docRef = snap.ref();
    if (data.state === "create") {
      // Code to create PDF goes here
      const inBucket = Storage.bucket('pdf-json-buckets');
      const outBucket = Storage.bucket('131project-processed-pdfs');

      const inFilePath = `./tmp/${context.params.docId}.tex`;
      const outFilePath = `./tmp/${context.params.docId}.pdf`;

      const inFile = inBucket.file(`${data.template}.tex`);

      await inFile.download({
        destination: inFilePath
      }, function(err) {
        console.log(`Error downloading template: ${err}`);
      }); 

      
      await fs.readFile(inFilePath, 'utf8', (err, originalData) => {
        if (err) {
          console.error('Error reading LaTeX file:', err);
          return;
        }
      
        const itemMap0 = data.items[0];
        const itemMap1 = data.items[1];
        const itemMap2 = data.items[2];
    
        let modifiedData = originalData;
        modifiedData = modifiedData.replace('<<customerName>>', data.client_name);
        modifiedData = modifiedData.replace('<<customerPhone>>', 'N/A');
        modifiedData = modifiedData.replace('<<customerAddress>>', data.client_address);
        modifiedData = modifiedData.replace('<<customerEmail>>', data.client_email);
    
        modifiedData = modifiedData.replace('<<companyName>>', data.host_name);
        modifiedData = modifiedData.replace('<<companyPhone>>', 'N/A');
        modifiedData = modifiedData.replace('<<companyAddress>>', data.host_location);
        modifiedData = modifiedData.replace('<<companyEmail>>', 'N/A');
    
        modifiedData = modifiedData.replace('<<invoiceNumber>>', 'N/A');
        modifiedData = modifiedData.replace('<<subTotal>>' , data.order_subtotal);
        modifiedData = modifiedData.replace('<<taxAmount>>' , data.order_tax);
        modifiedData = modifiedData.replace('<<totalAmount>>' , data.order_total);
        
        modifiedData = modifiedData.replace('<<product1Name>>' , itemMap0.name)
        modifiedData = modifiedData.replace('<<product1Cost>>' , itemMap0.cost)
        modifiedData = modifiedData.replace('<<product1Amount>>' , itemMap0.count)
    
        modifiedData = modifiedData.replace('<<product2Name>>' , itemMap1.name)
        modifiedData = modifiedData.replace('<<product2Cost>>' , itemMap1.cost)
        modifiedData = modifiedData.replace('<<product2Amount>>' , itemMap1.count)
    
        modifiedData = modifiedData.replace('<<product3Name>>' , itemMap2.name)
        modifiedData = modifiedData.replace('<<product3Cost>>' , itemMap2.cost)
        modifiedData = modifiedData.replace('<<product3Amount>>' , itemMap2.count)
    
          
        console.log('Template modified with doc data.');
  
        const options = { inputs: ['.', 'TeXworks'] };
        const outPDF = latex(modifiedData, options);
  
        outPDF.pipe(fs.createWriteStream(outFilePath));
        outPDF.on('finish',() => {
          console.log('PDF generated successfully.');
        });
      }).catch((error) => {
        console.error('Error getting document', error);
      });
      let uploading = await outBucket.upload(outFilePath);
      if (uploading.err) console.log(`Error uploading PDF: ${uploading.err}`);
      else console.log(`File uploaded: ${context.params.docId}.pdf`);

      await docRef.update({ state: "processed" });
    }
    /*
    if (data.state === "processed"){
      // code to send email
      const transporter = createTransport({
        service: "gmail",
        auth: {
          // uses dotenv npm to hide credentials
          user: config().env.email,
          pass: config().env.password
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
      const docRef = admin.firestore().doc(`coleTest/${context.params.docId}`);
      await docRef.update({ state: "completed" });
    }*/
  });
/*
export const updatePdf = _firestore
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
        const storage = new Storage();
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
            const docRef = firestore().doc(`coleTest/${context.params.docId}`);
            await docRef.update({ state: "processed" });
          })
          // marks end of writable stream
          .end(stdout);
      });
    
      

    } 
    if (data.state === "processed"){
      // code to send email
      const transporter = createTransport({
        service: "gmail",
        auth: {
          // uses dotenv npm to hide credentials
          user: config().env.email,
          pass: config().env.password
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
      const docRef = firestore().doc(`coleTest/${context.params.docId}`);
      await docRef.update({ state: "completed" });
    }
  });


*/
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

