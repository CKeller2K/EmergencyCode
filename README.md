CSC 131 Group Project Fall 2023
Group Emergency Code

Members:
- Cole          (colekellerwork@gmail.com)
- Shayn         (voonshayn@gmail.com)
- Mari          (Mariammoslehi@csus.edu)
- Kenny         (KennyYang519@gmail.com)
- Hassan        (haadhassan123@gmail.com)
- James         (jamesgarycrandall@gmail.com)

Made this file to keep a rough log of our current backlog.

------------------------------------------------------------------------------------------

Project Outline:

1. get document from firestore
  - desired template
  - target email
  - data

2. get template from google cloud "bucket"
  - saved as semi formatted file
  - json / pdf

3. apply data to template
  - expect data is formatted ideally, that's sam's problem
  - text wrapping
  - new lines / pages

4. save file
  - send file to target email
  - save copy to cloud bucket
  - mark document as processed

------------------------------------------------------------------------------------------

General Backlog:
- ✔️ understand the project
- ❌ split work accordingly
- ✔️ learn github, nodejs, firebase, sendgrid, pdfkit
- ✔️ create various test documents
- create various test templates
- ✔️ load data off firestore
- ✔️ send pdf attachment via sendgrid
- ✔️ send completed file to bucket

- [necessary] update template modification to take template from cloud
- [necessary] put template on cloud
- [necessary] save template to appropriate cloud functions local directory (?)
- [necessary] handle template getting through firestore doc
- [necessary] update firestore documents to have metadata map: include template, options (ie whether or not to send email), status, and errors
- [necessary] onupdate function should trigger on template variable update
- [preferable] update status for each stage: get template, add values, save pdf, save to bucket, send email, complete
- on error stop code, leaving status as the stage it error'd
- save error message to firestore doc
- [necessary] clear bucket of unrelated files for demo #2
- [necessary] create ideal input firestore doc for demo #2
- [optional] clear recieving email of test emails for demo #2

-----------------------------------------------------

Sprint Backlogs:

#1 (9/19 - 10/3):
Week 1:
- make sure project is understood
- decide on timing for potential weekly meetings
- decide on main presenter for 10/3 review with Sam
- create sub-groups with smaller scopes (?)
- make super basic document
- make super basic template (?)
  
Week 2:
- generate pdf with test info
- send pdf via email to presenter
- mark document as processed in firestore


#2 (uhh - 10/17):
Week 1:
- ???

Week 2:
- mash together code
- start deliverable #2
- prepare presentation notes
- make sure code is compatible with cloud functions











