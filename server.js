const dotenv = require("dotenv");
dotenv.config({ path: "./.env" });
const app = require("./app");
const mongoose = require("mongoose");
const port = 4000 || process.env.PORT;
mongoose.set("strictQuery", true);
mongoose
  .connect(process.env.DATABASE)
  .then(() => {
    console.log("Connected to Database!.");
  })
  .catch((err) => {
    console.log(err.message);
  });

app.listen(port, () => {
  console.log(`App running on port ${port}`);
});
