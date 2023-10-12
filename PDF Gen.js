const admin = require("firebase-admin");
const serviceAccount = require("./serviceAccKey.json");
const fs = require('fs');
const latex = require('node-latex');

admin.initializeApp({
  credential: admin.credential.cert(serviceAccount),
});

const db = admin.firestore();
const collectionRef = db.collection('coleTest');
const documentRef= collectionRef.doc('97025378921');

// Define file paths
const texFilePath = 'template.tex';
const backupTexFilePath = 'backup.tex'; // Create a backup file


// Read the original TeX file and create a backup
fs.readFile(texFilePath, 'utf8', (err, originalData) => {
  if (err) {
    console.error('Error reading LaTeX file:', err);
    return;
  }

  // Create a backup of the original content
  fs.writeFile(backupTexFilePath, originalData, 'utf8', (err) => {
    if (err) {
      console.error('Error creating a backup of the TeX file:', err);
      return;
    }
    console.log('Backup of the TeX file created:', backupTexFilePath);
  });

documentRef
.get()
.then((doc) => {
  if(doc.exists) {
    const data = doc.data();
    const dataArray1 = doc.data().items['0'];
    const dataArray2 = doc.data().items['1'];
    const dataArray3 = doc.data().items['2'];

    let modifiedData = originalData.replace('<<customerName>>', data.client_name);
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
    
    modifiedData = modifiedData.replace('<<product1Name>>' , dataArray1.name)
    modifiedData = modifiedData.replace('<<product1Cost>>' , dataArray1.cost)
    modifiedData = modifiedData.replace('<<product1Amount>>' , dataArray1.count)

    modifiedData = modifiedData.replace('<<product2Name>>' , dataArray2.name)
    modifiedData = modifiedData.replace('<<product2Cost>>' , dataArray2.cost)
    modifiedData = modifiedData.replace('<<product2Amount>>' , dataArray2.count)

    modifiedData = modifiedData.replace('<<product3Name>>' , dataArray3.name)
    modifiedData = modifiedData.replace('<<product3Cost>>' , dataArray3.cost)
    modifiedData = modifiedData.replace('<<product3Amount>>' , dataArray3.count)


    fs.writeFile(texFilePath, modifiedData, 'utf8', (err) => {
      if(err) {
        console.error('Error writing modified LaTeX file:', err);
        return;
      }
      
      console.log('Content replaced successfully.');

      const options = { inputs: ['.', 'TeXworks'] };
      const pdf = latex(modifiedData, options);

      pdf.pipe(fs.createWriteStream('Order_Sample.pdf'));
      pdf.on('finish',() => {
        console.log('PDF generated successfully.');
        resetTexFile();
      });
    });
  } else {
    console.log('Document does not exist');
  }
})
.catch((error) => {
  console.error('Error getting document', error);
});
});

// Function to reset the TeX file to its original content
function resetTexFile() {
  fs.readFile(backupTexFilePath, 'utf8', (err, originalData) => {
    if (err) {
      console.error('Error reading the backup TeX file:', err);
      return;
    }

    // Write the original backup content back to the TeX file
    fs.writeFile(texFilePath, originalData, 'utf8', (err) => {
      if (err) {
        console.error('Error resetting the TeX file:', err);
        return;
      }
      console.log('TeX file reset to its original content.');
    });
  });
}
