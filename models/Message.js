const MessageSchema = new mongoose.Schema({
    sender: String, // Will use email now
    receiver: String, // Will use email now
    message: String,
    timestamp: { type: Date, default: Date.now },
  });
  
  const Message = mongoose.model("Message", MessageSchema);

  module.exports = Message;