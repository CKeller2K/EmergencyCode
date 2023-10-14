//require("dotenv").config();
// create .env file with email credentials EMAIL= , PASSWORD= . DOTENV can hold other passwords and credentials too

//const serviceAccount = require("../ServiceAccountKey.json");
//const admin = require("firebase-admin");
const storage = require('@google-cloud/storage')();
const latex = require("node-latex");
const fs = require("fs");
const nodemailer = require("nodemailer");
//const sendGrid = require("sendGrid");
const functions = require("firebase-functions");

//admin.initializeApp({
  //credential: admin.credential.cert(serviceAccount)
//});

//save collection name and in / out buckets
const collectionName = "coleTest";
const inBucketName = "pdf-json-buckets";
const outBucketName = '131project-processed-pdfs';



/*
COLE UPDATE COMMENTS:




admin.initializeApp({
  credential: admin.credential.cert(serviceAccount)
});

code not tested AT ALL, but this might be unnecessary.
we need this to run code locally since we need to certify our code is being run by a project admin
but functions are being run by the project itself, and are assumed to be admin access
(functions are uploaded if you log in through cloud sdk which ensures code is made by a project admin)
also functions directory will not contain a serviceaccount key data file!!



"Compile the LaTeX document"
exec(`echo "${latex}" | pdflatex`, (error, stdout, stderr) => {
  if (error) {
    console.error("exec error: ${error}");
    return;
  }
});

this code runs echo in dir terminal instance- a windows equivalent to cat which prints file data to terminal




"uses dotenv npm to hide credentials"

can you? firestore holds the code after emulator launch, and idk how to save env file to firestore's directory
related: commented require line, BUT DID NOT UPDATE EMAIL CODE, DUNO HOW IT WORKS




"console.log(stuff)"

console logging is sent to firebase -> functions -> logs; for any reader that didn't know




onUpdate is extremely dangerous!!!!!!

we're calling multiple different cases of doc.update() in the same .onUpdate export, which CAN trigger itself
not sure if it'll trigger mid run and infinitely + recursively run itself!
also onCreate export might trigger onUpdate export due to using .update() itself!
NEED more checks like this (from first if statement in onUpdate):
"data.state === "create" && previousData.state !== "create""




outFile.createWriteStream()
  // informs if error has occured
  .on('error', (err) => {
    console.error(err);
  })
  // successfully saves pdf into file
  .on('finish', async () => {
    console.log('PDF saved to Firebase Storage.');

    // Update the 'state' field of the specific document to "processed"
    await docRef.update({ state: "processed" });
  })
  // marks end of writable stream
  .end(stdout);

I've updated this code to use current variables, but i dont' think this does anything?
outfile.createwritestream just opens a filestream with attribute write to the outFile object (opened in correct bucket path)
don't think it implicitly writes data
.upload is a storage function as well, which should work similar to .download, which is used here
*/






// firestore collection function triggers page: https://cloud.google.com/firestore/docs/extend-with-functions

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
      let inBucket = storage.bucket(inBucketName);
      let outBucket = storage.bucket(outBucketName);
      // specify template file using template data; TODO figure out error handling for file not exist
      let inFile = inBucket.file(`${data.template}.tex`); //TODO template should include file extension; currently hardcoded as .tex
      //specify output pdf as firebase doc name
      let outFile = outBucket.file(`${context.params.docId}.pdf`);

      //get template from bucket    CURRENTLY UNTESTED, ALSO TRY STORAGE.READFILE() STUFF
      await inFile.download({
        destination: `./tmp/${context.params.docId}.tex`
      }, function(err) {
        console.log(`Error downloading template: ${err}`);
      }); //use .then(function(){}) ?

      //add kenny code to process, expects tex file exists in /tmp/ subdirectory; after done, pdf expected in /tmp/ subdirectory


      // saves pdf into the bucket
      await outFile.createWriteStream()
        // informs if error has occured
        .on('error', (err) => {
          console.error(err);
        })
        // successfully saves pdf into file
        .on('finish', async () => {
          console.log('PDF saved to Firebase Storage.');

          // Update the 'state' field of the specific document to "processed"
          await docRef.update({ state: "processed" });
        })
        // marks end of writable stream
        .end(stdout);
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
      //REGARDLESS OF DOC STATUS, NEED TO RETURN PROMISE HERE? FOR NOW IS NULL
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
      let inBucket = storage.bucket(inBucketName);
      let outBucket = storage.bucket(outBucketName);
      // PDF uses unique Document ID as its name 
      let inFile = inBucket.file(`${data.template}.tex`); //see TODO's in onCreate implementation
      //specify output pdf as firebase doc name
      let outFile = outBucket.file(`${context.params.docId}.pdf`);

      //get template from bucket; same as onCreate: see notes there
      await inFile.download({
        destination: `./tmp/${context.params.docId}.tex`
      }, function(err) {
        console.log(`Error downloading template: ${err}`);
      });

      // put kenny code here


      // saves pdf into 'processed' bucket
      await outFile.createWriteStream()
        // informs if error has occured
        .on('error', (err) => {
          console.error(err);
        })
        // successfully saves pdf into file
        .on('finish', async () => {
          console.log('PDF saved to Firebase Storage.');
          // Update the 'state' field of the specific document to "processed"
          await docRef.update({ state: "processed" });
        })
        // marks end of writable stream
        .end(stdout);
    } else {
      //state anything other than create; dunno what go here
    }

    //do not manually (through firestore writing) update docs' state to processed, unknown outcome
    if (state === "processed"){
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
