require("dotenv").config();
const admin = require('firebase-admin');
const {Storage} = require('@google-cloud/storage');
const latex = require("node-latex");
const Handlebars = require('handlebars');
const fs = require("fs");
const fsp = require('fs/promises');
const sendGrid = require('@sendgrid/mail');
const {PubSub} = require("@google-cloud/pubsub");

const serviceAccount = require("./serviceAccountKey.json");
admin.initializeApp({
    credential: admin.credential.cert(serviceAccount)
});
const db = admin.firestore();
const storage = new Storage({
    credentials: serviceAccount
});
const pubsub = new PubSub({
    projectId: process.env.PROJECTID,
    credentials: serviceAccount
});
const subscription = pubsub.subscription(process.env.PUBSUB);

sendGrid.setApiKey(process.env.SENDGRIDKEY);

subscription.on('message', async (message) => {
    const docID = Buffer.from(message.data, 'base64').toString('utf-8');
    const collectionRef = db.collection(`${process.env.COLLECTION}`);
    const docRef = collectionRef.doc(`${docID}`);       //i really think this works; todo if it uh doesn't
    const data = await docRef.get().data();

    var errorBool = false;

    console.log(`Document triggered: ${change.doc.id}...`);

    //TODO work on checking data to remove docs that don't meet basics
    errorBool = (!data.hasOwnProperty('metaData'));
    if (errorBool) {
      console.log ("Improper document structure. Expected document information in metaData object.");
      return null;
    }
    const metaData = data.metaData;
    const inBucketName = metaData.inBucket;
    const outBucketName = metaData.outBucket;

    errorBool = metaData.state !== "create";    //shouldn't be possible since Functions checks this, but we'll be safe
    if (errorBool) {
      console.log("Update trigger 'create' not detected. Change 'state' variable to 'create' to begin processing.");
      return null;
    }

    // prep storage bucket objects
    const inBucket = storage.bucket(inBucketName);
    const outBucket = storage.bucket(outBucketName);
    // local / temporary file paths
    const inFilePath = `./tmp/${docID}.tex`;
    const outFilePath = `./tmp/${docID}.pdf`;
    // specify template file IN BUCKET using template data; remember template var needs to include extension :)
    const inFile = inBucket.file(`${metaData.template}`);

    await inFile.exists()
      .catch(function(err) {
          console.log(err);
          errorBool = true;
      })
      //.catch catches promise errors, .then is where file exists bool is sent; data is obj type, duno why
      .then(function(data) {
        if (data[0]) errorBool = false;
        else errorBool = true;
    });
    if (errorBool)
    return docRef.update({'metaData.state': "ERROR",
  'metaData.ERROR': `Error: Template does not exist: ${metaData.template}`,
  'metaData.timeError': admin.firestore.FieldValue.serverTimestamp()});
    else console.log("Template found in bucket.");

    //get template from bucket
    await inFile.download({destination: inFilePath})
      .catch(function(err) {
        console.log(err);
        errorBool = true;
      })
      .then(function(data) {
        //TODO figure out what's in data and update resultbool correctly. should include success or fail data.
        errorBool = false;
    });
    if (errorBool)
    return docRef.update({'metaData.state': "ERROR",
  'metaData.ERROR': `Error: Download failed for destination: ${inFilePath}`,
  'metaData.timeError': admin.firestore.FieldValue.serverTimestamp()});
    else console.log(`No error downloading. Sent to ${inFilePath}`);


    //read handlebars tex file from local dir
    //expects tex file exists in /tmp/ subdirectory; after done, pdf expected in /tmp/ subdirectory
    const originalData = await fsp.readFile(inFilePath, { encoding: 'utf8' });
    /*.catch(function(err) {
        console.log(err);
        errorBool = true;
    }).then(() => {
        errorBool = false;
    });*/
    if (errorBool)
    return docRef.update({'metaData.state': "ERROR",
  'metaData.ERROR': `Error: Reading downloaded template failed: ${inFilePath}`,
  'metaData.timeError': admin.firestore.FieldValue.serverTimestamp()});
    else console.log('No error reading download. Modifying...');

    var handlebarsTemplate;
    var latexDocument
    try { //TODO better error handling? what does .compile return?
      //read tex document into handlebars functional string
      handlebarsTemplate = Handlebars.compile(originalData);
      //compile handlebars with doc data pass-through -> traditional latex doc
      latexDocument = handlebarsTemplate(data);
      console.log('Template modified with doc data.');
      //console.log(latexDocument);
    }
    catch {
      return docRef.update({'metaData.state': "ERROR",
      'metaData.ERROR': `Error: Compiling and executing handlebars.js script failed: ${metaData.template}`,
      'metaData.timeError': admin.firestore.FieldValue.serverTimestamp()});
    }

    //TODO? can save completed tex file to ./tmp/ if need be
    // await fsp.writeFile(`${docId}.tex`, latexDocument);  //also needs error handling lol

    var options;
    var outPDF;
    try {
      //run pdflatex to compile latexDoc string to PDF file in ./tmp/ folder
      options = { inputs: ['.', 'TeXworks'] };
      outPDF = latex(latexDocument, options);
      console.log(`No error running PDFLatex.`);
    }
    catch {
      return docRef.update({'metaData.state': "ERROR",
      'metaData.ERROR': `Error: Compiling .tex string into .pdf string failed.`,  //TODO? no related + stable var to log
      'metaData.timeError': admin.firestore.FieldValue.serverTimestamp()});
    }

    await outPDF.pipe(fs.createWriteStream(outFilePath))
    .on('error', (error) => {
      console.log(`Write-stream pipe error: ${error}`)
      errorBool = true;
      return null;
    });
    if (errorBool)
    return docRef.update({'metaData.state': "ERROR",
      'metaData.ERROR': `Error: Write stream for PDF file failed: ${outFilePath}`,
      'metaData.timeError': admin.firestore.FieldValue.serverTimestamp()});
    else console.log('PDF generated successfully.');

    //upload finished pdf to processed bucket
    await outBucket.upload(outFilePath)
    .catch(function(err) {
      console.log(err);
      errorBool = true;
    }).then(function(data){
      //SEE DOWNLOAD BLOCK, UPLOAD COULD STILL FAIL IF HERE
      errorBool = false;
    });
    if (errorBool)
    return docRef.update({'metaData.state': "ERROR",
  'metaData.ERROR': `Error: PDF upload failed: ${outFilePath} -> ${outBucketName}`,
  'metaData.timeError': admin.firestore.FieldValue.serverTimestamp()});
    else console.log(`No error uploading: ${docID}.pdf sent to ${outBucketName}`);


    console.log(`Sending Email.`);

    var attachmentBuffer = await fsp.readFile(outFilePath, { encoding: 'base64' }); //TODO HERE AND ORIGINALDATA GET catching error from promise fucks with saving data
    /*.catch(function(err) {
      console.log(err);
      errorBool = true;
    }).then(() => {
      errorBool = false;
  });*/
  if (errorBool) //TODO big error here. returns for the .on(finish) of original read. return does not end doc execution
  return docRef.update({'metaData.state': "ERROR",
  'metaData.ERROR': `Error: Failed reading PDF to Base-64: ${outFilePath}`,
  'metaData.timeError': admin.firestore.FieldValue.serverTimestamp()});
  else console.log('No error reading download. Modifying...');

    const message = {
      to: process.env.EMAIL,
      from: 'CSC131.emergency.code@gmail.com',
      subject: 'PDF Generated',
      text: 'Check PDF is attached. Do not reply to this email.',
      attachments: [
        {
          filename: outFilePath,
          content: attachmentBuffer,
          type: 'application/pdf',
          disposition: 'attachment'
        }
      ]
    };
  
    sendGrid.send(message)
      .catch((error) => {
        console.error(error);
        errorBool = true;
      }).then((data) => {
        //see download / upload blocks: read data for status
        errorBool = false;
      });
    if(errorBool) 
    return docRef.update({'metaData.state': "ERROR",
  'metaData.ERROR': `Error: Failed to send email through SendGrid.`,
  'metaData.timeError': admin.firestore.FieldValue.serverTimestamp()});
    else console.log("No error sending email through SendGrid.");

    errorBool = false;

    if (errorBool)
    return docRef.update({'metaData.state': "ERROR",
  'metaData.ERROR': `Error: Write stream failed to create PDF: ${outFilePath}`,
  'metaData.timeError': admin.firestore.FieldValue.serverTimestamp()});
    
    // updates the state to completed
    console.log("Main thread finished, awaiting async functions.");
    return docRef.update({ 'metaData.state': "completed",
    'metaData.timeProcessed': admin.firestore.FieldValue.serverTimestamp()});

});