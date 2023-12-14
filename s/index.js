require("dotenv").config();
const admin = require('firebase-admin');
const {Storage} = require('@google-cloud/storage');
const latex = require("node-latex");
const Handlebars = require('handlebars');
const fs = require("fs");
const fsp = require('fs/promises');
const sendGrid = require('@sendgrid/mail');
const express = require('express');


//----Google Cloud project initialization----

//load verification from local file
const serviceAccount = require("./ServiceAccountKey.json");
admin.initializeApp({
    credential: admin.credential.cert(serviceAccount)
});
const storage = new Storage({
    credentials: serviceAccount
});

//initialize database object for document access
const db = admin.firestore();
//get collection identifier from env
const collectionName = process.env.COLLECTION;


//----Sendgrid api verification----

sendGrid.setApiKey(process.env.SENDGRIDKEY);

 
//----HTTP request app initialization----

const app = express();
app.use(express.json());
app.get('/', (req, res) => {
  res.send('Working URL.');
});




// APP HTTP POST REQUEST -> MAIN TRIGGER

app.post('/', async (req, res) => {

  //attempt to process received document
  await processDocument(req.body, db, collectionName)

    //success!
    .then( () => {

      //resolve post request
      res.status(200).send("Success! Reached end of program.");

    })

    //ultimate parent error catch!
    .catch( (error) => {

      //update console
      console.log(error);

      //resolve post request with input error status + basic error message
      res.status(400).send(error.message);

    });

});





const PORT = parseInt(parseInt(process.env.PORT)) || 8080;
app.listen(PORT, () => {
  console.log(`Run service attempting listen on port: ${PORT}`);
});









// ----Functions----



//returns: (Google bucket object)
//parameters: (string [Cloud Storage bucket name])
async function getBucket(bucketName){

  //get bucket object
  const bucket = await storage.bucket(bucketName);

  //check bucket exists in storage
  if (!(await bucketExists(bucket))) {
    throw(new Error(`Bucket '${bucketName}' not found in Cloud Storage.`));
  }

  return(bucket);

}



//returns: (boolean [T/F: storage has bucket])
//parameters: (Google bucket object)
async function bucketExists(bucket) {

  //exists() method returns array of data
  const data = await bucket.exists();

  //index 0 -> boolean
  return(data[0]);

}



//returns: (Google file object)
//parameters: (Google bucket object, string [Cloud Storage file name])
async function getFile(bucketObj, fileName){

  //check file is in bucket
  const file = await bucketObj.file(fileName);

  //if not exists: throw error
  if (!(await fileExists(file))) {
    throw(new Error(`File '${fileName}' not found in bucket.`));
  }

  return(file);

}



//returns: (boolean [T/F: bucket has file])
//parameters: (Google file object)
async function fileExists(file) {
  
  //exists() method returns array of data
  const data = await file.exists();

  //index 0 is boolean
  return(data[0]);

}



//returns: (string [path to file from dir])
//parameters: (string [Cloud Storage bucket name], string [Cloud Storage file name])
async function downloadFile(bucketName, fileName) {

  //get bucket object
  const inBucket = await getBucket(bucketName);
  
  //get file object from bucket
  const inFile = await getFile(inBucket, fileName);

  //local file keeps name of item in bucket -> tmp sub-directory
  const destination = `./tmp/${fileName}`;

  //download the file to destination
  await inFile.download({destination: destination});

  console.log(`No error downloading. Sent to ${destination}`);

  return(destination);

}



//returns: (void)
//parameters: (string [Cloud Storage bucket name], string [local file path])
async function uploadFile(bucketName, filePath) {

  const outBucket = await getBucket(bucketName);

  //upload the file to bucket
  await outBucket.upload(filePath);

  //console.log(`No error uploading. Sent to ${metaData[bucketType]}`);

}



//returns: (string [path to template from dir])
//parameters: (map [metaData])
async function getTemplate(metaData) {

  //first check if template exists
  if (!(metaData.hasOwnProperty('template'))) {
    //doesn't: major error!!
    throw(new Error(`Cannot process: 'template' not found in metaData.`));
  }

  //next check if template bucket exists
  if (!(metaData.hasOwnProperty('inBucket'))) {
    //also major error!
    throw(new Error(`Cannot process: 'template not found in metaData.`));
  }

  //both exist: attempt download -> return
  return await downloadFile(metaData['inBucket'], metaData['template']);

}



//returns: (list of strings [local file path(s)]) - currently irrelevant: pdflatex should find them automatically
//parameters: (map [metaData])
//comment: Function intended to get images required for a template to compile with PDFLatex.
async function getDependencies(metaData) {

  //check if dependencies list does not exist in doc
  if (!(metaData.hasOwnProperty('dependencies'))) {
    //if no such variable: no dependencies, return without error
    return [];
  }

  //dependencies found:
  //  save dependencies map [key: file name, value: bucket name]
  const dependencies = metaData['dependencies'];
  //  initialize output list
  var filePaths = [];

  //loop through every key in the map
  for (var key in dependencies) {

    //attempt to download represented file -> returns file path string
    //key is the file name and dependencies[key] is the value (bucket name)
    filePaths.push(await downloadFile(dependencies[key], key));

    //currently not testing for empty value -> may want default bucket 'outBucket'

  }

  return filePaths;

}



//returns: (string [latex formatted file])
//parameters: (map [data of entire Firestore doc], string [handlebars formatted latex file])
async function compileHandlebars(data, originalData) {

  //read tex document into handlebars functional string
  const handlebarsTemplate = Handlebars.compile(originalData);

  //compile handlebars with doc data pass-through -> traditional latex doc
  const latexDocument = handlebarsTemplate(data);

  console.log('Template modified with doc data.');
  
  //returns latex string
  return(latexDocument);

}



//returns: (void)
//parameters: (map [metaData from doc], string [local path to filled template])
async function saveTemplate(metaData, localTemplatePath){

  //check if saving template is defined: if not, return without error
  if (!(metaData.hasOwnProperty('saveFilledTemplate'))){
    console.log(`Not saving filled template. Add 'saveFilledTemplate' boolean if desired.`);
    return;
  }

  
  // ---saving desired: attempt upload---

  //check if 'saveFilledTemplate' option is bool or string
  if (metaData['saveFilledTemplate'] === false) {
    
    //if bool and false: return without error (weird, but ok)
    return;

  }

  else if (metaData['saveFilledTemplate'] === true) {

    //if bool and true: attempt upload -> default 'outBucket'
    //check if default bucket exists
    if (!(metaData.hasOwnProperty('outBucket'))) {
      //does not :(
      throw(new Error(`'outBucket' variable not found in metaData.`));
    }

    await uploadFile(metaData["outBucket"], localTemplatePath);
    console.log(`Filled LaTeX template uploaded to bucket: ${metaData['outBucket']}.`);

  }

  else {

    //'saveFilledTemplate' value is a string [Cloud Storage bucket name]
    //attempt upload there
    await uploadFile(metaData['saveFilledTemplate'], localTemplatePath);
    console.log(`Filled LaTeX template uploaded to bucket: ${metaData['saveFilledTemplate']}.`);

  }

}




//returns: (string [local path to pdf])
//parameters: (string [latex formatted data], string [document ID])
//comment: 'await stream.pipe()' does not 'await' data transfer. just pipe creation.
//         CURRENT KNOWN ISSUE: NODE-LATEX PACKAGE DOES NOT THROW PDFLATEX ERRORS CORRECTLY -> IF DEPENDENCY IS NOT LISTED IN DOC, ERROR WILL NOT LOG TO DOC
//         Have tried try/catch block and .catch() on latex call.
async function writePDF(latexString, docID) {

  //define options map for node-latex package dependencies
  const options = { inputs: ['.', 'TeXworks', './tmp'] };

  //call node-latex (pdflatex wrapper) on 'latex' string -> returns readable stream object
  const outPDFData = await latex(latexString, options);

  console.log("No error running pdflatex.");


  //define local file path / name: (document's Firstore ID).pdf
  const filePath = `./tmp/${docID}.pdf`;

  //wrapping write stream in an explicit promise function to ensure file is created before continuing
  await new Promise((resolve, reject) => {

    //pipe connects readable stream object to fresh write stream at filePath -> returns active writable stream
    const outPDFStream = outPDFData.pipe(fs.createWriteStream(filePath));

    //incase of error, reject current promise
    outPDFStream.on('error', () => {
      reject(`PDF write-stream failed.`);
    });

    //wait for pipe to finish transfer: write stream emits 'finish' on complete
    outPDFStream.on('finish', () => {

      console.log("Data finshed writing through stream pipe.");
      resolve();

    });

  //catch rejections from sub-function -> throw normal try/catch error
  }).catch((error) => {
    throw(new Error(error));
  });
  

  //Currently no check for "finish flag not emitted"
  return(filePath);

}



//returns: (void)
//parameters: (map [metaData], string [pdf local file path])
async function sendPDF(metaData, filePath) {

  //check default outBucket exists
  if (!(metaData.hasOwnProperty('outBucket'))) {
    //error: cannot save finished doc
    throw(new Error(`Cannot save PDF to storage: 'outBucket' not found in metaData.`));
  }

  //upload the PDF!
  await uploadFile(metaData.outBucket, filePath);

}



//expects: (Sendgrid API verification, several env delcarations for default values)
//returns: (void)
//parameters: (map [metaData from doc], string [local pdf path], string [Firestore doc ID])
async function sendEmail(metaData, filePath, docID) {

  //check if specified whether or not to send email; DEFAULT IS TRUE
  if (metaData.hasOwnProperty("sendEmail")) {
    //if false: resolve without continuing
    if (!metaData.sendEmail) {
      return;
    }
  }


  //if specified in doc: get optional email fields

  var receivingEmails;
  if (metaData.hasOwnProperty('receivingEmails')) {
    //check if list is empty -> reject error to notify user
    if (metaData.receivingEmails.length < 1) {
      throw(new Error(`'receivingEmails' array is empty.`));
    }

    //list exists and is not empty: saving to variable
    receivingEmails = metaData.receivingEmails;
  }

  else {
    //TOEMAIL default was intended to be the email associated with sendgrid
    receivingEmails = [process.env.TOEMAIL];
  }
  //receivingEmails is now an array of at least 1 email string


  var emailSubject;
  if (metaData.hasOwnProperty('emailSubject')) {
    emailSubject = metaData.emailSubject;
  }
  else {
    emailSubject = process.env.EMAILSUBJECTDEFAULT;
  }
  //emailSubject is now the email subject string


  var emailContent;
  if (metaData.hasOwnProperty('emailContent')) {
    emailContent = metaData.emailContent;
  }
  else {
    emailContent = process.env.EMAILCONTENTDEFAULT;
  }
  //emailContent is now the email contents string (plaintext / unformatted)



  //reading pdf to base64 encoding for sendgrid api
  const attachmentBuffer = await fsp.readFile(filePath, { encoding: 'base64' });

  console.log('No error reading PDF. Prepping email...');



  //loop over all to recieve emails and attempt to send emails to each
  //for (var email in receivingEmails) {    //UNKNOWN ERROR USING ABSTRACTED LOOP: SendGrid API error's "Bad Request". Using C-style loop works instead??
  for (var i = 0; i < receivingEmails.length; i++) {

    //define message according to sendgrid requirements
    let message = {
      //email to receive (ith index of array)
      //to: email,
      to: receivingEmails[i],

      //email to send (sendgrid registered email saved to env file)
      from: process.env.FROMEMAIL,

      subject: emailSubject,
      text: emailContent,

      attachments: [
        {
          filename: `${docID}.pdf`,
          content: attachmentBuffer,
          type: 'application/pdf',
          disposition: 'attachment'
        }
      ]
    };

    //attempt sendgrid api call
    await sendGrid.send(message);

    //console.log(`No error sending email '${email}' through SendGrid.`);
    console.log(`No error sending email '${receivingEmails[i]}' through SendGrid.`);

  }

}



//expects: (Google Cloud verified access)
//returns: (void)
//parameters: (HTTP request object [body of request], Firestore Database object [db], string [Firestore collection name])
async function processDocument(requestPayload, db, collectionName) {

  console.log(`Recieved request.`);

  //---check if request is OK---

  //check if payload has the only required value (Firestore doc ID) -> reject (error) if not
  if (!(requestPayload.hasOwnProperty('docID'))){
    throw(new Error(`Request does not include required value 'docID'.`));
  }

  //save ID to own variable. toString() just in case
  const docID = requestPayload.docID.toString();

  console.log(`Beginning processing on document '${docID}'.`);



  //---get Firestore document data through series of GCS calls---
  //could be done in one step, only need data variable

  //collection string -> Google collection object
  const collectionRef = db.collection(collectionName);
  //collection object -> Google document object
  const docRef = collectionRef.doc(docID);
  //doc object -> get Google snapshot object (literal snapshot of document data at time of call)
  const snapshot = await docRef.get();
  //snapshot object -> save map of Firstore doc variables [data]
  const data = snapshot.data();



  // ----   Begin Processing   ----

  console.log(`Document found: /${collectionName}/${docID}...`);

  //save program data for future processing
  //Cloud Functions code only sends requests if metaData exists
  const metaData = data.metaData;

  //check if status is still 'create', just in case
  if (!(metaData.state === 'create')) {
    throw(new Error(`Between request and document retrieval 'state' was changed from 'create'.`));
  }



  //download template from expected default bucket
  const localTemplatePath = await getTemplate(metaData);



  //check for and download other dependencies from dependencies list
  const dependencyPaths = await getDependencies(metaData);


  //read handlebars format latex file from local dir
  const originalData = await fsp.readFile(localTemplatePath, { encoding: 'utf8' });

  

  //create traditional latex document from handlebars template
  const latexDocument = await compileHandlebars(data, originalData);



  //save filled template to local dir - overwrites unfilled template
  await fsp.writeFile(localTemplatePath, latexDocument, 'utf-8');

  console.log(`Filled LaTeX template saved: ${localTemplatePath}`);

  

  //simple wrapper function to find a bucket and upload filled template
  //upload filled tex doc to third (optional) bucket; currently cannot send via email
  await saveTemplate(metaData, localTemplatePath);



  //convert latex string to pdf data and save pdf to local file with name of Firestore doc name / ID
  const localPDFPath = await writePDF(latexDocument, docID);



  //upload finished pdf to output bucket
  await sendPDF(metaData, localPDFPath);

  console.log(`No error uploading: ${docID}.pdf sent to ${localPDFPath}`);



  //send finished pdf to email(s)
  await sendEmail(metaData, localPDFPath, docID);



  // ----   Process Finished   ----

  console.log("Main process finished.");

}