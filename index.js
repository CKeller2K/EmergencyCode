const admin = require("firebase-admin");
const serviceAccount = require("./serviceAccKey.json");
const firebase = require('firebase-admin');
const PDFDoc = require('pdfkit');
const fs = require('fs');
const sendGrid = require('@sendgrid/mail');


admin.initializeApp({
  credential: admin.credential.cert(serviceAccount)
});

const projectId = 'csc-131-project-398318';
const db = admin.firestore();
const collectionRef = db.collection("coleTest");
const storage = new Storage();

//TODO fix .env file to import key without hardcoding
//sendGrid.setApiKey(process.env.SENDGRID_API_KEY);
sendGrid.setApiKey('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');


function processDocument (document){
  var fileName = 'N/A';

  //data type #1; firestore doc has 4 sub divisions: client, host, order, and template
  if (document.data()['template'] === 0) {
    const client = document.data()['user_data'];
    const host = document.data()['shop_data'];
    const order = document.data()['order'];

    let doc = new PDFDoc();
    //open doc for editing: createWriteStream takes a string input for file name; here name made with client name + order number
    fileName = `${client['name']}${order['order_number']}.pdf`;
    doc.pipe(fs.createWriteStream(`${client['name']}${order['order_number']}.pdf`));

    doc.fontSize(16).text('Order\n', {align: 'center'});

    //print data
    //can use \n or doc.moveDown() to create lines, movedown takes spacing ex: doc.moveDown(.5)
    doc.font('Times-Italic');
    doc.fontSize(12).text(`
    Subtotal: ${order['subtotal']}\n
    Tax (8.25%): ${order['subtotal'] * 0.0825}\n
    Total: ${order['total']}\n\n\n
    Date: ${order['date']} || Order #: ${order['order_number']}\n
    Sending Reciept to ${client['email']}
    `, {align: 'left'});
    if (! client['reward_member']) doc.text(`\n\nConsider joining the rewards program!`, {align: 'center'});

    doc.end();
  }

  //data type #2; no sub divisions -> all in document data map
  else if (document.data()['template'] === 1){
  }
  
  return fileName;
}


//takes filename, sends that file to hardcoded email
//TODO figure out how to get email from processDocument, add argument to emailDoc
function emailDocument(fileName){
  const attachmentBuffer = fs.readFileSync(fileName);
  const attachmentBase64 = attachmentBuffer.toString('base64');

  const message = {
    to: 'YOUR EMAIL HERE',     //TO EMAIL HARDCODED, CHANGE TO YOURS HERE
    from: 'CSC131.emergency.code@gmail.com',
    subject: 'Processed File Sent',
    text: 'Check PDF is attached. Do not reply to this email.',
    attachments: [
      {
        filename: fileName,
        content: attachmentBase64, 
        type: 'application/pdf',
        disposition: 'attachment'
      }
    ]
  };

  sendGrid.send(message)
    .catch((error) => {
      console.error(error);
    });
}



  

//processing loop waits for collection 'change' and processes added documents
//also attempts to process all existing documents
collectionRef.onSnapshot((snapshot) => {
  snapshot.docChanges().forEach((change) => {
    if (change.type !== 'added') return;
    else if (change.doc.data()['processed'] === true) return;


    //TODO GET + REFERENCE TEMPLATE -> format for processDocument()


    //func processes doc into a pdf file using data gotten above
    // TODO function call not working as intended with new documents
    let fileName = processDocument(change.doc);

    
    //TODO store output to bucket

    
    //func sends pdf attachment via email to client_email !! COMMENTED BECAUSE IT SENDS AN EMAIL EVERY RUN FOR EVERY DOC !!
    //TODO fix email pass from processDoc
    emailDocument(fileName);

    
    //updates document with processed key and sets to true (creates key if not found)
    //change.doc.ref.update({processed: true, timeProcessed: firebase.firestore.Timestamp.now()});
    });
});
