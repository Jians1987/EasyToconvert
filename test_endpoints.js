const fs = require('fs');
const path = require('path');

async function testJopdfExport() {
  const form = new FormData();
  form.append('file', new Blob([fs.readFileSync('test.pdf')]), 'test.pdf');
  form.append('format', 'docx');
  
  console.log('Testing /api/pdf/jopdf-export...');
  const res = await fetch('http://localhost:3005/api/pdf/jopdf-export', {
    method: 'POST',
    body: form
  });
  
  if (!res.ok) {
    console.error('Failed jopdf-export:', await res.text());
  } else {
    const buffer = await res.arrayBuffer();
    fs.writeFileSync('test_output.docx', Buffer.from(buffer));
    console.log('Success! Output saved as test_output.docx, size:', buffer.byteLength);
  }
}

async function testCompress() {
  const form = new FormData();
  form.append('file', new Blob([fs.readFileSync('test.pdf')]), 'test.pdf');
  
  console.log('Testing /api/pdf/compress...');
  const res = await fetch('http://localhost:3005/api/pdf/compress', {
    method: 'POST',
    body: form
  });
  
  if (!res.ok) {
    console.error('Failed compress:', await res.text());
  } else {
    const buffer = await res.arrayBuffer();
    fs.writeFileSync('test_output_compressed.pdf', Buffer.from(buffer));
    console.log('Success! Output saved as test_output_compressed.pdf, size:', buffer.byteLength);
  }
}

async function run() {
  await testJopdfExport();
  await testCompress();
  process.exit(0);
}
run();
