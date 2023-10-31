require("dotenv").config();
const admin = require('firebase-admin');
const {Storage} = require('@google-cloud/storage');
const storage = new Storage();
const latex = require("node-latex");
const Handlebars = require('handlebars');
const fs = require("fs");
const fsp = require('fs/promises');
const sendGrid = require('@sendgrid/mail');

const serviceAccount = require("./serviceAccountKey.json");
admin.initializeApp({
    credential: admin.credential.cert(serviceAccount)
});
const db = admin.firestore();
const collectionRef = db.collection(process.env.COLLECTION);

sendGrid.setApiKey(process.env.SENDGRIDKEY);

collectionRef.onSnapshot((snapshot) => {
    snapshot.docChanges().forEach( async (change) => {
    const docRef = change.doc.ref;
    const data = change.doc.data();
    const docID = change.doc.id;
    var resultBool = false;

    console.log(`Document triggered: ${change.doc.id}...`);

    //TODO work on checking data to remove docs that don't meet basics
    resultBool = (!data.hasOwnProperty('metaData'));
    if (resultBool) {
      console.log ("Improper document structure. Expected document information in metaData object.");
      return null;
    }
    const metaData = data.metaData;
    const inBucketName = metaData.inBucket;
    const outBucketName = metaData.outBucket;

    resultBool = metaData.state !== "create";
    if (resultBool) {
      console.log("Update trigger 'create' not detected. Change 'state' variable to begin processing.");
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
          resultBool = true;
      })
      //.catch catches promise errors, .then is where file exists bool is sent; data is obj type, duno why
      .then(function(data) {
        if (data[0]) resultBool = false;
        else resultBool = true;
    });
    if (resultBool)
    return docRef.update({'metaData.state': "ERROR", 'metaData.ERROR': `Error: Template does not exist: ${metaData.template}`, 'metaData.timeProcessed': admin.firestore.FieldValue.serverTimestamp()});
    else console.log("Template found in bucket.");

    //get template from bucket
    await inFile.download({destination: inFilePath})
      .catch(function(err) {
        console.log(err);
        resultBool = true;
      })
      .then(function(data) {
        //TODO figure out what's in data and update resultbool correctly. should include success or fail data.
        resultBool = false;
    });
    if (resultBool)
    return docRef.update({'metaData.state': "ERROR", 'metaData.ERROR': `Error: Download failed for destination: ${inFilePath}`, 'metaData.timeProcessed': admin.firestore.FieldValue.serverTimestamp()});
    else console.log(`No error downloading. Sent to ${inFilePath}`);


    //read handlebars tex file from local dir
    //expects tex file exists in /tmp/ subdirectory; after done, pdf expected in /tmp/ subdirectory
    const originalData = await fsp.readFile(inFilePath, { encoding: 'utf8' });
    /*.catch(function(err) {
        console.log(err);
        resultBool = true;
    }).then(() => {
        resultBool = false;
    });*/
    if (resultBool)
    return docRef.update({'metaData.state': "ERROR", 'metaData.ERROR': `Error: Reading downloaded template failed: ${inFilePath}`, 'metaData.timeProcessed': admin.firestore.FieldValue.serverTimestamp()});
    else console.log('No error reading download. Modifying...');

    //read tex document into handlebars functional string
    //TODO error handling lmao; what does Handlebars.compile return?? the second line????
    const handlebarsTemplate = Handlebars.compile(originalData);
    //compile handlebars with doc data pass-through -> traditional latex doc
    const latexDocument = handlebarsTemplate(data);

    //TODO? can save completed tex file to ./tmp/ if need be
    // await fsp.writeFile(`${docId}.tex`, latexDocument);  //also needs error handling lol
      
    console.log('Template modified with doc data.');

    //run pdflatex to compile latexDoc string to PDF file in ./tmp/ folder
    const options = { inputs: ['.', 'TeXworks'] };
    const outPDF = latex(latexDocument, options);  //TODO no idea how to error catch this. error at the moment this always stops program!!!
    console.log(`No error running PDFLatex.`);

    await outPDF.pipe(fs.createWriteStream(outFilePath))
    .on('error', (error) => {
      console.log(`Write-stream pipe error: ${error}`)
      resultBool = true;
      return null;
    })
    .on('finish', async () => {
      console.log('PDF generated successfully.');

      //upload finished pdf to processed bucket
      await outBucket.upload(outFilePath)
      .catch(function(err) {
        console.log(err);
        resultBool = true;
      }).then(function(data){
        //SEE DOWNLOAD BLOCK, UPLOAD COULD STILL FAIL IF HERE
        resultBool = false;
      });
      if (resultBool)
      return docRef.update({'metaData.state': "ERROR", 'metaData.ERROR': `Error: PDF upload failed: ${outFilePath} -> ${outBucketName}`, 'metaData.timeProcessed': admin.firestore.FieldValue.serverTimestamp()});
      else console.log(`No error uploading: ${docID}.pdf sent to ${outBucketName}`);


      console.log(`Sending Email.`);

      var attachmentBuffer = await fsp.readFile(outFilePath, { encoding: 'base64' }); //TODO HERE AND ORIGINALDATA GET catching error from promise fucks with saving data
      /*.catch(function(err) {
        console.log(err);
        resultBool = true;
      }).then(() => {
        resultBool = false;
    });*/
    if (resultBool) //TODO big error here. returns for the .on(finish) of original read. return does not end doc execution
    return docRef.update({'metaData.state': "ERROR", 'metaData.ERROR': `Error: Failed reading PDF to Base-64: ${outFilePath}`, 'metaData.timeProcessed': admin.firestore.FieldValue.serverTimestamp()});
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
          resultBool = true;
        }).then((data) => {
          //see download / upload blocks: read data for status
          resultBool = false;
        });
      if(resultBool) 
      return docRef.update({'metaData.state': "ERROR", 'metaData.ERROR': `Error: Failed to send email through SendGrid.`, 'metaData.timeProcessed': admin.firestore.FieldValue.serverTimestamp()});
      else console.log("No error sendinding email through SendGrid.");

      resultBool = false;
    });
    if (resultBool)
    return docRef.update({'metaData.state': "ERROR", 'metaData.ERROR': `Error: Write stream failed to create PDF: ${outFilePath}`, 'metaData.timeProcessed': admin.firestore.FieldValue.serverTimestamp()});
    
    // updates the state to completed
    console.log("Main thread finished, awaiting async functions.");
    return docRef.update({ 'metaData.state': "completed" });

  });
});