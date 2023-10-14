require("dotenv").config();
const { initializeApp, applicationDefault, cert } = require('firebase-admin/app');
const { getFirestore, Timestamp, FieldValue, Filter } = require('firebase-admin/firestore');
const storage = require('@google-cloud/storage')();
const latex = require("node-latex");
const fs = require("fs");
const nodemailer = require("nodemailer");
//const sendGrid = require("sendGrid");
const functions = require("firebase-functions");

//initialize firestore for serverside cloud functions; dunno if necessary, functions tutorials don't use it, but whatever
initializeApp();
//initialize database constant    (commented out cause not used: references are made to specific documents on triggers)
//const db = getFirestore();

//save collection name and in / out buckets
const collectionName = process.env.COLLECTION;
const inBucketName = process.env.INBUCKET;
const outBucketName = process.env.OUTBUCKET;



/*
PROGRAM MUST KNOWS:

obviously code only currently works on documents that have the exact data as coleTest/97025378921
either make doc same as that, or work on onUpdate so that doc can be used




admin.initializeApp({
  credential: admin.credential.cert(serviceAccount)
});

code not tested AT ALL, but this might be unnecessary.
we need this to run code locally since we need to certify our code is being run by a project admin
but functions are being run by the project itself, and are assumed to be admin access
(functions are uploaded if you log in through cloud sdk which ensures code is made by a project admin)
also functions directory will not contain a serviceaccount key data file!!




"console.log(stuff)"

console logging is sent to firebase -> functions -> logs; for any reader that didn't know




onUpdate is extremely dangerous!!!!!!

we're calling multiple different cases of doc.update() in the same .onUpdate export, which CAN trigger itself
not sure if it'll trigger mid run and infinitely + recursively run itself!
also onCreate export might trigger onUpdate export due to using .update() itself!
NEED more checks like this (from first if statement in onUpdate):
"data.state === "create" && previousData.state !== "create""
*/





// FIRESTORE DOC CREATION TRIGGER
exports.createDoc = functions.firestore
  //{docId} DOES NOT NEED A '$', THIS IS A VARIABLE HANDLED BY CLOUD FUNCTIONS; docId IS THE DOC THAT IS CHANGED
  .document(`${collectionName}/{docId}`)
  //parameters snap and context are doc 'snapshot' and backend 'context' respectively
  .onCreate(async (snap, context) => {  //watch out, cloud functions often return promises

    const docRef = snap.ref();
    const data = snap.data();



    //EXPECTED NEW DOCS DO NOT PROCESS UNLESS STATE == 'CREATE'
    if (data.state === "create") {
      // load in / out bucket objects
      const inBucket = storage.bucket(inBucketName);
      const outBucket = storage.bucket(outBucketName);
      // local / temporary file paths
      const inFilePath = `./tmp/${context.params.docId}.tex`;
      const outFilePath = `./tmp/${context.params.docId}.pdf`;
      // specify template file IN BUCKET using template data; TODO figure out error handling for file not exist
      const inFile = inBucket.file(`${data.template}.tex`); //TODO template should include file extension; currently hardcoded as .tex

      //get template from bucket    CURRENTLY UNTESTED, ALSO TRY STORAGE.READFILE() STUFF
      await inFile.download({
        destination: inFilePath
      }, function(err) {
        console.log(`Error downloading template: ${err}`);
      }); //use .then(function(){}) ?


      //kenny code to process, expects tex file exists in /tmp/ subdirectory; after done, pdf expected in /tmp/ subdirectory
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


      //upload finished pdf to processed bucket
      let uploading = await outBucket.upload(outFilePath);
      if (uploading.err) console.log(`Error uploading PDF: ${uploading.err}`);
      else console.log(`File uploaded: ${context.params.docId}.pdf`);

      await docRef.update({ state: "processed" });

      } else {
        // STATE NOT CREATE: DOC WRITER DID NOT WANT FILE TO BE INITIALLY PROCESSED; SEND PDF NOT HANLDED THROUGH FIRESTORE DOC
      }



      if (data.state === "processed"){
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
              //path: `gs://pdf-json-buckets/${snap.id}.pdf`,
              path: `./tmp/${context.params.docId}.pdf`,
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
        await docRef.update({ state: "completed" });
      } else {
        //STATE NOT PROCESSED, UPDATE DOC WITH ERROR + STATE AS ERROR AT PROCESS
      }
      //regardless of status return something? promises, how do those work?
      return null;
  });










  //FIRESTORE DOC UPDATE TRIGGER
  exports.updateDoc = functions.firestore
  .document(`${collectionName}/{docId}`)
  .onUpdate(async (change, context) => {

    const docRef = change.after.ref();
    // change.after.data() gives data of the document after the update
    const data = change.after.data();
    // change.before.data() gives data of the document before the update
    const previousData = change.before.data();



    //only triggers if state flag in firestore doc is modified to 'create'; ie the change/update is state updating
    if (data.state === "create" && previousData.state !== "create") {
      // prep storage bucket objects
      const inBucket = storage.bucket(inBucketName);
      const outBucket = storage.bucket(outBucketName);
      // local / temporary file paths
      const inFilePath = `./tmp/${context.params.docId}.tex`;
      const outFilePath = `./tmp/${context.params.docId}.pdf`;
      // specify template file IN BUCKET using template data; TODO figure out error handling for file not exist
      const inFile = inBucket.file(`${data.template}.tex`); //TODO template should include file extension; currently hardcoded as .tex

      //get template from bucket; same as onCreate: see notes there
      await inFile.download({
        destination: inFilePath
      }, function(err) {
        console.log(`Error downloading template: ${err}`);
      });


      //kenny code to process, expects tex file exists in /tmp/ subdirectory; after done, pdf expected in /tmp/ subdirectory
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


      //upload finished pdf to processed bucket
      let uploading = await outBucket.upload(outFilePath);
      if (uploading.err) console.log(`Error uploading PDF: ${uploading.err}`);
      else console.log(`File uploaded: ${context.params.docId}.pdf`);

      await docRef.update({ state: "processed" });

    } else {
      //state anything other than create; dunno what go here
    }



    //do not manually (through firestore writing) update docs' state to processed, unknown outcome
    if (data.state === "processed" && previousData.state !== "processed"){
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
            path: `./tmp/${context.params.docId}.pdf`,
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
      await docRef.update({ state: "completed" });
    } else {
      //state not processed, dunno what go here
    }
    //same as onCreate: cloud functions return promises(???)
    return null;
  });
