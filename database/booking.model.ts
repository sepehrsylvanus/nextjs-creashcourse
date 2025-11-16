import mongoose, { Schema, Document, Model, Types } from 'mongoose';
import { Event, EventDocument } from './event.model';

// Attributes required to create a Booking
export interface BookingAttrs {
  eventId: Types.ObjectId;
  email: string;
}

// Booking document stored in MongoDB
export interface BookingDocument extends Document, BookingAttrs {
  createdAt: Date;
  updatedAt: Date;
}

// Booking model type
export type BookingModel = Model<BookingDocument>;

// Basic email format validation regex for server-side validation
const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

const bookingSchema = new Schema<BookingDocument, BookingModel>(
  {
    eventId: {
      type: Schema.Types.ObjectId,
      ref: 'Event',
      required: true,
      index: true, // index for faster queries by event
    },
    email: {
      type: String,
      required: true,
      trim: true,
      lowercase: true,
    },
  },
  {
    timestamps: true, // automatically manage createdAt and updatedAt
  }
);

// Pre-save hook to:
// - Validate email format
// - Ensure the referenced event exists before saving the booking
bookingSchema.pre<BookingDocument>('save', async function preSave(next) {
  const doc = this;

  if (!doc.email || !EMAIL_REGEX.test(doc.email)) {
    return next(new Error('A valid email address is required.'));
  }

  if (!doc.eventId) {
    return next(new Error('eventId is required.'));
  }

  try {
    // Check that the referenced event exists to avoid orphaned bookings
    const eventExists = await Event.exists({ _id: doc.eventId } as Partial<EventDocument>);
    if (!eventExists) {
      return next(new Error('The referenced event does not exist.'));
    }
  } catch (error) {
    return next(error as Error);
  }

  next();
});

// Reuse existing model in development to avoid OverwriteModelError
export const Booking: BookingModel =
  (mongoose.models.Booking as BookingModel) ||
  mongoose.model<BookingDocument, BookingModel>('Booking', bookingSchema);

export default Booking;
