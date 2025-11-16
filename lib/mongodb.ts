import mongoose from 'mongoose';

// Shape of the cached connection object stored on the Node.js global scope
interface MongooseGlobal {
  conn: typeof mongoose | null;
  promise: Promise<typeof mongoose> | null;
}

// Augment the global scope type so TypeScript knows about `global.mongoose`
// This is safe because `global` is shared across hot-reloads in development.
declare global {
  // eslint-disable-next-line no-var
  var mongooseConn: MongooseGlobal | undefined;
}

// Read the MongoDB connection string from environment variables
// Throw early if it is missing so the error surfaces clearly at startup.
const MONGODB_URI = process.env.MONGODB_URI;

if (!MONGODB_URI) {
  throw new Error('Please define the MONGODB_URI environment variable in your environment.');
}

// Use a global cached object so that in development we don't create a new
// connection on every hot reload. In production, this object will only
// be created once per server instance.
const cached: MongooseGlobal = global.mongooseConn ?? {
  conn: null,
  promise: null,
};

if (!global.mongooseConn) {
  global.mongooseConn = cached;
}

/**
 * Establishes (or reuses) a Mongoose connection to MongoDB.
 *
 * - Returns an existing connection if one is already established.
 * - Otherwise, creates a new connection and caches it for future reuse.
 */
export async function connectToDatabase(): Promise<typeof mongoose> {
  // If an active connection already exists, reuse it.
  if (cached.conn) {
    return cached.conn;
  }

  // If a connection is already being established, await that promise.
  if (!cached.promise) {
    const options: mongoose.ConnectOptions = {
      // Add any production-grade options here as needed.
      // For example: maxPoolSize, serverSelectionTimeoutMS, etc.
      bufferCommands: false,
    };

    cached.promise = mongoose.connect(MONGODB_URI as string, options).then((mongooseInstance) => {
      return mongooseInstance;
    });
  }

  // Wait for the connection to be established and cache the resolved connection.
  cached.conn = await cached.promise;
  return cached.conn;
}

export default connectToDatabase;
