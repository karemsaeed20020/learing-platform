import mongoose from "mongoose";

const connectDB = async () => {
  return await mongoose
    .connect(process.env.MONGO_URL)
    .then(() => {
      console.log("Connected To MongoDB");
    })
    .catch((err) => {
      console.log("Error To Connect MongoDB", err);
    });
};

export default connectDB;
