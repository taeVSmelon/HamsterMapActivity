import mongoose from "mongoose";
import AutoIncrement from "../plugins/autoIncrement.js";

const fuseSchema = new mongoose.Schema(
  {
    item1: {
      type: Number,
      required: true,
    },
    item2: {
      type: Number,
      required: true,
    },
    results: [
      {
        _id: false,
        itemId: {
          type: Number,
          required: true,
        },
        rate: {
          type: Number,
          required: true,
          min: 1,
        },
      },
    ],
  },
  { timestamps: true },
);

fuseSchema.plugin(AutoIncrement, { id: 'fuse_id', inc_field: 'id', start_seq: 1000000 });

const fuseModel = mongoose.model("Fuse", fuseSchema, "Fuse");

export default fuseModel;
