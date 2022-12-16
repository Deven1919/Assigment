const express = require('express');
const router = express.Router();
const authController = require('../Controller/authController');
const uploads = require('../Controller/postController');
const crypto = require('crypto');
const { privateKey, publicKey } = crypto.generateKeyPairSync('rsa', {
  modulusLength: 2048,
});

router.post('/signup', authController.signUp);
router.post('/login', authController.login);
router.post(
  '/upload',
  authController.verify,
  uploads.single('avatar'),
  (req, res) => {
    try {
      // make sure the file is available
      let avatar = req.file;

      if (!avatar) {
        throw new Error('Please select the file from device!.');
      }

      // Using Hashing Algorithm
      const algorithm = 'SHA256';

      const data = Buffer.from('my');
      console.log(data);
      // // Sign the data and returned signature in buffer
      const signature = crypto.sign(algorithm, data, privateKey).toString();

      // send response
      res.send({
        status: 'success',
        message: 'File is uploaded.',
        signature,
        data: {
          name: avatar.originalname,
          mimetype: avatar.mimetype,
          size: avatar.size,
        },
      });
    } catch (err) {
      res.status(500).json({
        status: 'F',
        message: err.message,
      });
    }
  }
);
router.get('/getfile', authController.readData);
router.get('/download', authController.download);
router.delete('/delete', authController.deleteFile);
module.exports = router;
