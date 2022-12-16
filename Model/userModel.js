const mongoose = require('mongoose');
const validator = require('validator');
const bcrypt = require('bcryptjs');
//const crypto = require('crypto');

const userSchema = new mongoose.Schema({
  name: {
    type: String,
    required: [true, 'A name field must required'],
  },
  email: {
    type: String,
    required: true,
    unique: true,
    lowercase: true,
    validate: [validator.isEmail, 'Please provide a valid E-mail ID.'],
  },
  photo: {
    type: String,
  },

  password: {
    type: String,
    required: [true, 'A password must be unique'],
    maxlength: 8,
    select: false,
  },
  confirmPassword: {
    type: String,
    required: [true, 'Please confirm your password.'],
    validate: {
      validator: function (el) {
        return el === this.password;
      },
      message: 'password is not matched!',
    },
  },
});

//MANAGEING THE PASSWORD.
//pre()=This method is use for getting & posting the data at same time. from document
// so it is easier to set the encrption at the time of getting & posting the data.
userSchema.pre('save', async function (next) {
  //Only run this function when password is modified.
  if (!this.isModified('password')) return next();
  //Hashing the password
  this.password = await bcrypt.hash(this.password, 12); // cost used for encrypt the password
  // it should be in good range other wise the
  // system take much time to encrypt the password.
  //Setting the confirm password field to null.
  this.confirmPassword = undefined;
  next();
});

// this is an instance method so it is available on every document
userSchema.methods.correctPassword = async function (
  candidatePassword,
  userPassword
) {
  return await bcrypt.compare(candidatePassword, userPassword);
  //compare the password which is the password while posting & password in database.
};

userSchema.pre('save', function (next) {
  if (!this.isModified('password') || this.isNew) return next();

  this.passwordChangedAt = Date.now() - 1000;
  next();
});

const User = mongoose.model('User', userSchema);
module.exports = User;
