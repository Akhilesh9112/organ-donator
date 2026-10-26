import mongoose from "mongoose";
// Writes to shared resource documents serialize overlapping scheduling decisions.
const schema = new mongoose.Schema(
  { _id: String, revision: { type: Number, default: 0 } },
  { versionKey: false },
);
export default mongoose.model("SchedulingResource", schema);
