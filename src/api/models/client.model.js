import mongoose, { Schema } from "mongoose";

const clientSchema = new Schema(
    {
        name: {
            type: String,
            required: true,
            trim: true,
        },
        url : {
            type: String,
            trim: true,
        },
        image: {
            type: String, 
        }
    },
    {
        timestamps: true,
    },
);

export const Client = mongoose.model("Client", clientSchema);