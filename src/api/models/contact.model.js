import mongoose, { Schema } from "mongoose";

const contactSchema = new Schema(
  {
    // Contact Information
    phone: {
      type: String,
      trim: true,
    },
    email: {
      type: String,
      trim: true,
      lowercase: true,
    },
    address: {
      street: {
        type: String,
        trim: true,
      },
      city: {
        type: String,
        trim: true,
      },
      state: {
        type: String,
        trim: true,
      },
      zipCode: {
        type: String,
        trim: true,
      },
      country: {
        type: String,
        trim: true,
      },
    },
    businessHours: {
      type: String,
      trim: true,
    },

    // Social Media Links
    socialMedia: {
      facebook: {
        type: String,
        trim: true,
      },
      twitter: {
        type: String,
        trim: true,
      },
      instagram: {
        type: String,
        trim: true,
      },
      linkedin: {
        type: String,
        trim: true,
      },
      youtube: {
        type: String,
        trim: true,
      },
      whatsapp: {
        type: String,
        trim: true,
      },
      telegram: {
        type: String,
        trim: true,
      },
    },

    // Additional Information
    about: {
      type: String,
      trim: true,
    },
    mission: {
      type: String,
      trim: true,
    },
    vision: {
      type: String,
      trim: true,
    },

    // Admin who last updated
    updatedBy: {
      type: Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
  },
  {
    timestamps: true,
  },
);

// Ensure only one contact document exists
contactSchema.pre("save", async function (next) {
  if (this.isNew) {
    const existingContact = await mongoose.model("Contact").findOne();
    if (existingContact) {
      throw new Error("Contact information already exists. Use update instead.");
    }
  }
  next();
});

export const Contact = mongoose.model("Contact", contactSchema);