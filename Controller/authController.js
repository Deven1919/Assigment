const { promisify } = require('util');
const User = require('../Model/userModel');
const jwt = require('jsonwebtoken');
const fs = require('fs');
const download = require('download');

const signIn = ({ id }) => {
  return jwt.sign({ id }, process.env.JWT_KEY, {
    expiresIn: process.env.EXPIRES,
  });
};

exports.signUp = async (req, res, next) => {
  try {
    const user = await User.create({
      name: req.body.name,
      email: req.body.email,
      password: req.body.password,
      confirmPassword: req.body.confirmPassword,
    });
    const token = signIn({ id: user._id });
    //console.log(token);
    // console.log(user);

    res.status(200).json({
      status: 'success',
      data: [user],
      token,
    });
  } catch (err) {
    res.status(401).json({
      status: 'F',
      message: err,
    });
  }
  next();
};

exports.login = async (req, res, next) => {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      throw new Error('please enter email & password');
    }

    const user = await User.findOne({ email }).select('+password');

    if (!user || !(await user.correctPassword(password, user.password))) {
      throw new Error('Incorrect email & password!.');
    }
    // If all okk then send the token
    const token = signIn({ id: user._id });
    res.status(200).json({
      status: 'success',
      token,
    });
  } catch (err) {
    res.status(401).json({
      status: 'fail',
      message: err.message,
    });
    next();
  }
};

exports.verify = async (req, res, next) => {
  try {
    let token;
    if (
      req.headers.authorization &&
      req.headers.authorization.startsWith('Bearer')
    ) {
      token = req.headers.authorization.split(' ')[1];
    }

    if (!token) {
      throw new Error('You are not logged in! Please log in to get access.!');
    }
    const decoded = await promisify(jwt.verify)(token, process.env.JWT_KEY);

    const currentUser = await User.findById(decoded.id);
    console.log(currentUser);
    if (!currentUser) {
      throw new Error('The user belonging to this token does no longer exist.');
    }
  } catch (err) {
    res.status(401).json({
      status: 'fail',
      message: err.message,
    });
  }
  next();
};

exports.readData = async (req, res, next) => {
  await fs.readdir(`${__dirname}/../uploads`, function (err, files) {
    if (err) {
      throw new Error('Directory not Found.');
    }
    files.forEach(function (file) {
      console.log(file);
    });

    return res.send({
      status: 'success',
      message: 'Data getting ',
      data: [files],
    });
  });
  next();
};

exports.deleteFile = (req, res, next) => {
  try {
    fs.readdir(`${__dirname}/../uploads`, function (err, files) {
      if (err) {
        throw new Error('Directory not Found.');
      }
      //if (!files) throw new Error('No file for deletion');
      //const path= '.'
      for (const file of files) {
        fs.unlinkSync(`${__dirname}/../uploads/` + file);
        console.log(file + ':Data deleted successfully');
      }
    });

    return res.send({
      status: 'success',
      message: ': Data deleted successfully ',
    });
  } catch (err) {
    res.send({
      status: 'F',
      message: err.message,
    });
  }

  next();
};

exports.download = (req, res, next) => {
  try {
    fs.readdir(`${__dirname}/../uploads`, (err, files) => {
      if (err) {
        throw new Error('Directory not found!');
      }

      for (const file of files) {
        // const filePath = `${__dirname}/../downloadfile`;
        download(`${__dirname}/../downloadfile` + file).then(() => {
          console.log('Download Completed');
        });
      }
    });

    // return res.json({
    //   status: 'success',
    //   // data: file,
    //   message: 'Download Done',
    // });
  } catch (err) {
    res.json({
      status: 'F',
      message: err.message,
    });
  }
  next();
};
