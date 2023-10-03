const admin = require("firebase-admin");
const serviceAccount = require("./serviceAccKey.json");
const firebase = require('firebase-admin');
const {Storage} = require('@google-cloud/storage');
const PDFDoc = require('pdfkit');
const fs = require('fs');



admin.initializeApp({
  credential: admin.credential.cert(serviceAccount)
});

const projectId = 'csc-131-project-398318';
const db = admin.firestore();
const collectionRef = db.collection("coleTest");
const storage = new Storage();



// TODO add new doc var for data segmentation? template will be taken by template names
//  +2 arguments for template and data storage;  3rd default would be no sub division
//remember takes document obj, not data map
//returns pdf name; ('N/A' means error, no file created!!!)
function processDocument (document){
  var fileName = 'N/A';

  //data type #1; 3 sub divisions + template
  if (document.data()['template'] === 0) {
    //every doc should have a client, host, order, and template
    const client = document.data()['user_data'];
    const host = document.data()['shop_data'];
    const order = document.data()['order'];

    let doc = new PDFDoc();
    //open doc for editing: createWriteStream takes a string input for file name; here name made with client name + order number
    fileName = `${client['name']}${order['order_number']}.pdf`;
    doc.pipe(fs.createWriteStream(fileName));

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

  //data type #2; no sub divisions
  else if (document.data()['template'] === 1){
  }
  return fileName;
}

//takes filename string, sends to processed files bucket in project cloud
function storeDocument(fileName){
  const file = storage.bucket('131project-processed-pdfs').file(fileName);
  fs.createReadStream(fileName).pipe(file.createWriteStream());
}






//processing loop waits for collection 'change' and processes added documents
collectionRef.onSnapshot((snapshot) => {
  snapshot.docChanges().forEach((change) => {

    //does not process docs that are not new
    if (change.type !== 'added') return;
    else if (change.doc.data()['processed'] === true) return;


    //TODO GET + REFERENCE TEMPLATE -> format for processDocument()


    //func processes doc into a pdf file using data gotten above
    // TODO function call not working as intended with new documents
    //  either learn how change.doc works, or switch function to take data map
    let fileName = processDocument(change.doc);

    
    //func sends data to 'processed' bucket
    storeDocument(fileName);


    //func sends pdf attachment via email to client_email !! COMMENTED BECAUSE IT SENDS AN EMAIL EVERY RUN FOR EVERY DOC
    //TODO fix email pass from processDoc
    //emailDocument(fileName);


    //updates document with processed key and sets to true (creates key if not found)
    change.doc.ref.update({processed: true, timeProcessed: firebase.firestore.Timestamp.now()});


    //TODO delete local file after sending to right places
    });
    //TODO error catching here as well, "onSnapshot().catch not a function"
});
