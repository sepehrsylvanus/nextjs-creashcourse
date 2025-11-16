import mongoose, { Schema, Document, Model } from 'mongoose';

// Attributes required to create an Event
export interface EventAttrs {
  title: string;
  slug?: string; // generated from title
  description: string;
  overview: string;
  image: string;
  venue: string;
  location: string;
  date: string; // stored as normalized ISO date (YYYY-MM-DD)
  time: string; // stored as normalized 24h time (HH:mm)
  mode: string;
  audience: string;
  agenda: string[];
  organizer: string;
  tags: string[];
}

// Event document stored in MongoDB
export interface EventDocument extends Document, EventAttrs {
  slug: string;
  createdAt: Date;
  updatedAt: Date;
}

// Event model type
export type EventModel = Model<EventDocument>;

// Simple slug generator to create a URL-friendly identifier from the title
const slugify = (value: string): string => {
  return value
    .toString()
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-') // replace non-alphanumeric with hyphen
    .replace(/^-+|-+$/g, ''); // trim leading/trailing hyphens
};

// Normalize a time string to HH:mm (24h) format.
// Accepts formats like "HH:mm", "H:mm", "HHmm".
const normalizeTime = (value: string): string | null => {
  const trimmed = value.trim();

  // Match HH:mm or H:mm
  const match = trimmed.match(/^([0-2]?\d):([0-5]\d)$/);
  if (match) {
    let [_, h, m] = match;
    const hour = parseInt(h, 10);
    if (hour > 23) return null;
    const hh = hour.toString().padStart(2, '0');
    return `${hh}:${m}`;
  }

  // Match HHmm or Hm
  const compactMatch = trimmed.match(/^([0-2]?\d)([0-5]\d)$/);
  if (compactMatch) {
    const hour = parseInt(compactMatch[1], 10);
    const minutes = compactMatch[2];
    if (hour > 23) return null;
    const hh = hour.toString().padStart(2, '0');
    return `${hh}:${minutes}`;
  }

  return null;
};

const eventSchema = new Schema<EventDocument, EventModel>(
  {
    title: { type: String, required: true, trim: true },
    slug: { type: String, unique: true, index: true },
    description: { type: String, required: true, trim: true },
    overview: { type: String, required: true, trim: true },
    image: { type: String, required: true, trim: true },
    venue: { type: String, required: true, trim: true },
    location: { type: String, required: true, trim: true },
    date: { type: String, required: true },
    time: { type: String, required: true },
    mode: { type: String, required: true, trim: true },
    audience: { type: String, required: true, trim: true },
    agenda: {
      type: [String],
      required: true,
      validate: {
        validator: (value: string[]): boolean => value.length > 0,
        message: 'Agenda must contain at least one item.',
      },
    },
    organizer: { type: String, required: true, trim: true },
    tags: {
      type: [String],
      required: true,
      validate: {
        validator: (value: string[]): boolean => value.length > 0,
        message: 'Tags must contain at least one tag.',
      },
    },
  },
  {
    timestamps: true, // automatically manage createdAt and updatedAt
  }
);

// Pre-save hook to:
// - Validate required fields are non-empty
// - Generate/refresh slug when title changes
// - Normalize date to ISO (YYYY-MM-DD)
// - Normalize time to HH:mm (24h)
eventSchema.pre<EventDocument>('save', function preSave(next) {
  const doc = this;

  // Ensure required string fields are present and non-empty
  const requiredStringFields: Array<keyof EventAttrs> = [
    'title',
    'description',
    'overview',
    'image',
    'venue',
    'location',
    'date',
    'time',
    'mode',
    'audience',
    'organizer',
  ];

  for (const field of requiredStringFields) {
    const value = doc[field];
    if (typeof value !== 'string' || value.trim().length === 0) {
      return next(new Error(`${field} is required and must be a non-empty string.`));
    }
  }

  if (!Array.isArray(doc.agenda) || doc.agenda.length === 0) {
    return next(new Error('agenda is required and must contain at least one item.'));
  }

  if (!Array.isArray(doc.tags) || doc.tags.length === 0) {
    return next(new Error('tags is required and must contain at least one tag.'));
  }

  // Regenerate slug only if title has changed or slug is missing
  if (doc.isModified('title') || !doc.slug) {
    doc.slug = slugify(doc.title);
  }

  // Normalize date to ISO date string (YYYY-MM-DD)
  if (doc.date) {
    const parsed = new Date(doc.date);
    if (Number.isNaN(parsed.getTime())) {
      return next(new Error('Invalid date format. Expected a valid date string.'));
    }
    doc.date = parsed.toISOString().split('T')[0];
  }

  // Normalize time to HH:mm (24h)
  if (doc.time) {
    const normalized = normalizeTime(doc.time);
    if (!normalized) {
      return next(new Error('Invalid time format. Use HH:mm or a similar 24h format.'));
    }
    doc.time = normalized;
  }

  next();
});

// Ensure a unique index on slug at the schema level
eventSchema.index({ slug: 1 }, { unique: true });

// Reuse existing model in development to avoid OverwriteModelError
export const Event: EventModel =
  (mongoose.models.Event as EventModel) || mongoose.model<EventDocument, EventModel>('Event', eventSchema);

export default Event;
