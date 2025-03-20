// //defining the schema
// const mongoose = require('mongoose');
// const Schema = mongoose.Schema;
// const mySchema = new Schema({
//     name: String,
//     email : String,
//     phone : String,
//     password : String,
//     confirm_password : String,
//     age: Number
// });

// //creating the model
// const myModel = mongoose.model('MyModel', mySchema); // myModel is the name of the model
// module.exports = myModel;

// models/User.js
const mongoose = require('mongoose');
// Define the schema
const userSchema = new mongoose.Schema({
    name: { type: String, required: true },
    email: { type: String, required: true, unique: true },
    phone: { type: String },
    password: { type: String, required: true },
    age: { type: Number, required: true },
  });

    // Create the model
  const User = mongoose.model("User", userSchema);
  module.exports = User;