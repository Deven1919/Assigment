// // Importing Required Modules
// const crypto = require('crypto');

// // Creating a private key
// const { privateKey, publicKey } = crypto.generateKeyPairSync('rsa', {
//   modulusLength: 2048,
// });
// // Using Hashing Algorithm
// const algorithm = 'SHA256';

// const data = Number('my-secret-key');
// console.log(data);
// // Sign the data and returned signature in buffer
// const signature = crypto.sign(algorithm, data, privateKey);

// // Verifying signature using crypto.verify() function
// //const isVerified = crypto.verify(algorithm, data, publicKey, signature);

// //const fs = require('fs')
