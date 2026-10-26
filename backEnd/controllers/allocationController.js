import mongoose from "mongoose";
import Allocation from "../models/Allocation.js";
import OrganRequest from "../models/OrganRequest.js";
import { asyncRoute, fail } from "../middleware/validation.js";
export const createAllocation = asyncRoute(async (req, res) => {
  const session = await mongoose.startSession();
  let allocation;
  try {
    await session.withTransaction(async () => {
      const request = await OrganRequest.findOneAndUpdate(
        {
          _id: req.body.requestId,
          hospitalId: req.user._id,
          status: "Accepted",
        },
        { $set: { status: "Hospital Review" } },
        { returnDocument: "after", session },
      );
      if (!request)
        fail(409, "An accepted case assigned to your hospital is required");
      [allocation] = await Allocation.create(
        [
          {
            requestId: request._id,
            donorId: request.donorId,
            recipientId: request.recipientId,
            pledgeId: request.pledgeId,
            hospitalId: req.user._id,
            organ: request.organ,
          },
        ],
        { session, ordered: true },
      );
    });
  } finally {
    await session.endSession();
  }
  res.status(201).json({ message: "Hospital review started", allocation });
});
